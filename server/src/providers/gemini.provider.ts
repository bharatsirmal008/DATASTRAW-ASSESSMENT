import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { AIProvider, ProviderResponse, ToolCallExecution } from './provider.interface';
import { ConversationMessage, SessionContext } from '../services/session.service';
import { ARIA_SYSTEM_PROMPT } from '../agents/aria.prompt';
import { getAvailableTools, executeTool } from '../tools/toolRegistry';
import { isCatalogConfigured } from '../services/catalog.service';
import { catalogSystemPrompt } from '../agents/catalog.prompt';
import { providerFailure } from './provider.errors';
import { withGeminiFallback } from './gemini.fallback';
import { isAssessmentMode } from '../config/application';

export class GeminiProvider implements AIProvider {
  readonly mode = 'GEMINI' as const;

  private getClient(): { ai: GoogleGenAI; model: string } {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      const error = new Error(
        'Gemini API key is not configured. Please set GEMINI_API_KEY in server/.env to enable AI support.'
      );
      (error as Error & { code?: string; status?: number }).code = 'GEMINI_NOT_CONFIGURED';
      (error as Error & { code?: string; status?: number }).status = 503;
      throw error;
    }

    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 12000 } });
    return { ai, model };
  }

  async generateResponse(params: {
    userMessage: string;
    messages: ConversationMessage[];
    context: SessionContext;
  }): Promise<ProviderResponse> {
    const { ai, model } = this.getClient();
    const deadline = Date.now() + 22000;
    const abortSignal = AbortSignal.timeout(22000);
    const languageInstruction = params.context.responseLanguage === 'hi'
      ? 'Trusted conversation language: Hindi (hi). Reply in natural, concise Hindi using Devanagari. Keep order IDs such as ORD-101 and all verified amounts unchanged. Never translate or change tool names, arguments or identifiers.'
      : 'Trusted conversation language: English (en). Reply only in English with ASCII digits. Do not switch to Hindi or Devanagari.';
    const executedToolCalls: ToolCallExecution[] = [];
    let contextPatch: Partial<SessionContext> | undefined;

    // Convert function declarations for Gemini
    const functionDeclarations = Object.values(getAvailableTools()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'OBJECT' as any,
        properties: Object.fromEntries(
          Object.entries(tool.parameters.properties).map(([propName, propSchema]) => [
            propName,
            {
              type: propSchema.type.toUpperCase() as any,
              description: propSchema.description,
              ...(propSchema.enum ? { enum: propSchema.enum } : {}),
            },
          ])
        ),
        required: tool.parameters.required,
      },
    }));

    // Build conversation history (up to last 15 messages for context window bounds)
    const history = params.messages.at(-1)?.role === 'user' && params.messages.at(-1)?.content === params.userMessage
      ? params.messages.slice(0, -1) : params.messages;
    const recentMessages = history.slice(-14);
    const contents: any[] = recentMessages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Add current user turn
    contents.push({
      role: 'user',
      parts: [{ text: params.userMessage }],
    });

    const MAX_TOOL_STEPS = 5;
    let stepCount = 0;
    let finalContent = '';

    while (stepCount < MAX_TOOL_STEPS) {
      stepCount++;

      let response: any;
      try {
        response = await withGeminiFallback(model, selectedModel => ai.models.generateContent({
          model: selectedModel,
          contents,
          config: {
            abortSignal,
            httpOptions: { timeout: Math.max(1, Math.min(12000, deadline - Date.now())) },
            ...(selectedModel === 'gemini-3.8-flash' ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            systemInstruction: `${isCatalogConfigured() ? catalogSystemPrompt() : ARIA_SYSTEM_PROMPT}\n${isAssessmentMode() ? 'This is the Aura Skincare assessment. get_order_details reads the three supplied mock orders, not real customer records. Their relative delivery times are fixed scenario facts; do not calculate new dates from them. Normalize spoken order numbers such as O R D one zero one to ORD-101. Use policy tools for eligibility and fees; get_brand_policies for general brand or policy questions. Preserve the customer request when asking for a missing order number. Never interpret an order ID as a price. Do not invent product ingredients, support contacts or tracking links.' : ''}\n${languageInstruction}\nVerified conversation context: ${JSON.stringify(params.context)}\nKeep spoken answers to 1-3 short sentences. Ask one clarification at a time. Never claim to have contacted support, cancelled an order, or issued a refund.`,
            tools: [{ functionDeclarations }],
          },
        }));
      } catch (err: any) {
        console.error('[GeminiProvider] API call failed with status:', err?.status || 'unknown');
        throw providerFailure(err);
      }

      const candidate = response?.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Extract function calls if any
      const functionCalls: any[] = [];
      for (const part of parts) {
        if (part.functionCall) {
          functionCalls.push(part.functionCall);
        }
      }

      // If no function calls, we have the final model response
      if (functionCalls.length === 0) {
        finalContent = parts.filter((part: any) => typeof part.text === 'string').map((part: any) => part.text).join('');
        break;
      }

      // Add model's assistant turn with functionCalls to contents history
      contents.push(candidate.content);

      // Execute each tool call and construct function response parts
      const responseParts: any[] = [];
      for (const call of functionCalls) {
        const toolName = call.name;
        const toolArgs = call.args || {};

        let toolResult: any;
        try {
          toolResult = await executeTool(toolName, toolArgs);
        } catch (execErr: any) {
          toolResult = { error: execErr?.message || 'Tool execution failed' };
        }

        // Summary for developer UI tracking
        let summary = `Tool ${toolName}`;
        if (toolResult?.error) {
          summary = 'The requested information could not be verified';
        } else if (toolName === 'search_catalog') {
          summary = `${toolResult.products.length} catalog matches checked`;
          contextPatch = { ...contextPatch, recentCatalogProducts: toolResult.products.map((product: any) => ({ id: product.id, name: product.name })) };
          if (toolResult.products.length === 1) contextPatch.latestProductId = toolResult.products[0].id;
        } else if (toolName === 'get_catalog_product') {
          summary = `Checked ${toolResult.product.name}`;
          contextPatch = { ...contextPatch, latestProductId: toolResult.product.id };
        } else if (toolName === 'get_catalog_categories') {
          summary = `${toolResult.categories.length} categories checked`;
        } else if (toolName === 'get_catalog_info') {
          summary = `Verified ${toolResult.businessName} catalog information`;
        } else if (toolName === 'get_order_details') {
          summary = toolResult?.found
            ? `Found order ${toolArgs.order_id} (${toolResult?.order?.status})`
            : `Order ${toolArgs.order_id} not found`;
          if (toolResult?.found && toolResult.order?.orderId) {
            contextPatch = { latestOrderId: toolResult.order.orderId };
          } else {
            contextPatch = { ...contextPatch, latestOrderId: undefined };
          }
        } else if (toolName === 'check_cancellation_eligibility') {
          summary = `Cancellation: ${toolResult?.status} (${toolResult?.policyCode})`;
        }

        executedToolCalls.push({
          name: toolName,
          args: toolArgs,
          result: toolResult,
          resultSummary: summary,
        });

        responseParts.push({
          functionResponse: {
            name: toolName,
            response: { output: toolResult },
          },
        });
      }

      // Feed function responses back into conversation as 'user' role
      contents.push({
        role: 'user',
        parts: responseParts,
      });
    }

    if (!finalContent.trim()) {
      throw Object.assign(new Error('The AI service did not return a usable answer. Please try again.'), { code: 'AI_EMPTY_RESPONSE', status: 502 });
    }

    return {
      content: finalContent.trim(),
      mode: this.mode,
      toolCalls: executedToolCalls,
      contextPatch,
    };
  }
}
