import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  ConversationSession,
  ConversationMessage,
  ProviderMode,
} from '../types/conversation';
import type { PostCallData } from '../types/summary';
import {
  createSessionApi,
  sendMessageApi,
  endSessionApi,
  getPostCallApi,
  getSessionApi,
} from '../services/conversation.api';

export function useConversation(autoInit = true) {
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [providerMode, setProviderMode] = useState<ProviderMode>('GEMINI');
  const [postCallData, setPostCallData] = useState<PostCallData | null>(null);
  const [isLoadingPostCall, setIsLoadingPostCall] = useState<boolean>(false);

  const sessionRef = useRef<ConversationSession | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const startNewSession = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    setLastFailedMessage(null);
    setPostCallData(null);
    try {
      const newSession = await createSessionApi();
      sessionRef.current = newSession;
      setSession(newSession);
      setMessages(newSession.messages);
      return newSession;
    } catch (err: any) {
      setError({
        message: err?.message || 'Failed to initialize conversation session.',
        code: err?.code,
      });
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Auto initialize on first render if requested
  useEffect(() => {
    if (autoInit && !sessionRef.current) {
      startNewSession();
    }
  }, [autoInit, startNewSession]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      let currentSession = sessionRef.current;
      if (!currentSession || currentSession.status === 'ENDED') {
        currentSession = await startNewSession();
        if (!currentSession) return;
      }

      setIsSending(true);
      setError(null);
      setLastFailedMessage(null);

      // Optimistic local user message
      const tempUserMsg: ConversationMessage = {
        id: 'temp-' + Date.now(),
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      try {
        const result = await sendMessageApi(currentSession.id, trimmed);
        sessionRef.current = result.session;
        setSession(result.session);
        setMessages(result.session.messages);
        setProviderMode(result.mode);
      } catch (err: any) {
        // Remove optimistic message on failure and store for retry
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        setLastFailedMessage(trimmed);
        setError({
          message: err?.message || 'Failed to send message.',
          code: err?.code,
        });
      } finally {
        setIsSending(false);
      }
    },
    [startNewSession]
  );

  const retryLastMessage = useCallback(() => {
    if (lastFailedMessage) {
      const msg = lastFailedMessage;
      setLastFailedMessage(null);
      setError(null);
      sendMessage(msg);
    }
  }, [lastFailedMessage, sendMessage]);

  const endCurrentSession = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession || currentSession.status === 'ENDED') return;

    setIsLoadingPostCall(true);
    try {
      const ended = await endSessionApi(currentSession.id);
      sessionRef.current = ended;
      setSession(ended);
      setMessages(ended.messages);
      const postCall = await getPostCallApi(currentSession.id);
      setPostCallData(postCall);
    } catch (err: any) {
      // Ending is recorded before AI summary generation; preserve the final
      // transcript and expose summary retry even when the provider hits quota.
      const ended = await getSessionApi(currentSession.id).catch(() => null);
      if (ended) {
        sessionRef.current = ended;
        setSession(ended);
        setMessages(ended.messages);
      }
      setError({
        message: err?.message || 'Failed to end session.',
        code: err?.code,
      });
    } finally {
      setIsLoadingPostCall(false);
    }
  }, []);

  const retryPostCall = useCallback(async () => {
    if (!sessionRef.current || sessionRef.current.status !== 'ENDED') return;
    setIsLoadingPostCall(true);
    setError(null);
    try { setPostCallData(await getPostCallApi(sessionRef.current.id)); }
    catch (err: any) { setError({ message: err?.message || 'Could not generate the summary.', code: err?.code }); }
    finally { setIsLoadingPostCall(false); }
  }, []);

  return {
    session,
    messages,
    isInitializing,
    isSending,
    error,
    lastFailedMessage,
    providerMode,
    postCallData,
    setPostCallData,
    isLoadingPostCall,
    startNewSession,
    sendMessage,
    retryLastMessage,
    endCurrentSession,
    retryPostCall,
  };
}
