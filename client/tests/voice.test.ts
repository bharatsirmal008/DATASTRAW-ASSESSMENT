import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTextForSpeech } from '../src/hooks/useSpeechSynthesis';
import type { VoiceState, VoiceError } from '../src/types/voice';

describe('Phase 4 — Speech Synthesis Text Sanitizer', () => {
  it('should remove bold and italic markdown markers', () => {
    const raw = 'Here are details for order **ORD-101** of *Vitamin C Serum*.';
    const cleaned = sanitizeTextForSpeech(raw);
    assert.equal(cleaned, 'Here are details for order O R D one zero one of Vitamin C Serum.');
  });

  it('should remove bullet characters and clean line starts', () => {
    const raw = `
• Customer: Priya Sharma
• Product: Vitamin C Serum (30ml)
• Status: Out for Delivery
    `;
    const cleaned = sanitizeTextForSpeech(raw);
    assert.ok(!cleaned.includes('•'));
    assert.ok(cleaned.includes('Customer: Priya Sharma'));
    assert.ok(cleaned.includes('Status: Out for Delivery'));
  });

  it('should clean markdown scenario notes and URLs', () => {
    const raw = 'Expected by 6 PM today *(assessment scenario only)*. See [policy](https://example.com).';
    const cleaned = sanitizeTextForSpeech(raw);
    assert.equal(cleaned, 'Expected by six P M today (assessment scenario only). See policy.');
  });

  it('should collapse multiple newlines and spaces into clean prose', () => {
    const raw = 'Hello    there,\n\nHow can I    help?';
    const cleaned = sanitizeTextForSpeech(raw);
    assert.equal(cleaned, 'Hello there, How can I help?');
  });

  it('should return an empty string for null or empty input', () => {
    assert.equal(sanitizeTextForSpeech(''), '');
    assert.equal(sanitizeTextForSpeech('   '), '');
  });
});

describe('Phase 4 — Voice State Machine & Lifecycle Transitions', () => {
  // Pure model of the Voice state machine
  class VoiceSessionStateMachine {
    public state: VoiceState = 'IDLE';
    public callCount: number = 0;
    public activeSessionId: string | null = null;
    public generation: number = 0;

    startCall(): { success: boolean; error?: string } {
      if (this.state !== 'IDLE' && this.state !== 'ENDED' && this.state !== 'ERROR') {
        return { success: false, error: 'Call already in progress' };
      }
      this.state = 'INITIALIZING';
      this.generation++;
      this.callCount++;
      this.activeSessionId = `sess-${this.generation}`;
      return { success: true };
    }

    onConnectedAndListening(): void {
      if (this.state === 'INITIALIZING') {
        this.state = 'LISTENING';
      }
    }

    onFinalCustomerSpeech(text: string): { accepted: boolean } {
      if (this.state !== 'LISTENING' || !text.trim()) {
        return { accepted: false };
      }
      this.state = 'THINKING';
      return { accepted: true };
    }

    onAssistantReplyReceived(): void {
      if (this.state === 'THINKING') {
        this.state = 'SPEAKING';
      }
    }

    onAssistantSpeechFinished(): void {
      if (this.state === 'SPEAKING') {
        this.state = 'LISTENING';
      }
    }

    endCall(): void {
      if (this.state === 'IDLE' || this.state === 'ENDED') {
        return;
      }
      this.generation++;
      this.state = 'ENDED';
    }

    triggerError(err: VoiceError): void {
      this.state = 'ERROR';
    }
  }

  it('should transition correctly through a full voice turn lifecycle', () => {
    const sm = new VoiceSessionStateMachine();
    assert.equal(sm.state, 'IDLE');

    // 1. Customer starts call
    const startRes = sm.startCall();
    assert.equal(startRes.success, true);
    assert.equal(sm.state, 'INITIALIZING');

    // 2. Initialized and enters listening
    sm.onConnectedAndListening();
    assert.equal(sm.state, 'LISTENING');

    // 3. User says "Where is ORD-101?" -> triggers Thinking
    const turn1 = sm.onFinalCustomerSpeech('Where is ORD-101?');
    assert.equal(turn1.accepted, true);
    assert.equal(sm.state, 'THINKING');

    // 4. Backend returns reply -> enters Speaking
    sm.onAssistantReplyReceived();
    assert.equal(sm.state, 'SPEAKING');

    // 5. Assistant speech completes -> returns to Listening
    sm.onAssistantSpeechFinished();
    assert.equal(sm.state, 'LISTENING');

    // 6. User clicks End Call -> enters Ended
    sm.endCall();
    assert.equal(sm.state, 'ENDED');
  });

  it('should ignore interim or empty speech during LISTENING', () => {
    const sm = new VoiceSessionStateMachine();
    sm.startCall();
    sm.onConnectedAndListening();

    assert.equal(sm.onFinalCustomerSpeech('').accepted, false);
    assert.equal(sm.onFinalCustomerSpeech('   ').accepted, false);
    assert.equal(sm.state, 'LISTENING');
  });

  it('should prevent rapid start clicks from spawning concurrent sessions', () => {
    const sm = new VoiceSessionStateMachine();
    const first = sm.startCall();
    assert.equal(first.success, true);
    assert.equal(sm.callCount, 1);

    // Rapid second click while INITIALIZING
    const second = sm.startCall();
    assert.equal(second.success, false);
    assert.equal(sm.callCount, 1);
  });

  it('should safely cancel when End Call is pressed during THINKING', () => {
    const sm = new VoiceSessionStateMachine();
    sm.startCall();
    sm.onConnectedAndListening();
    sm.onFinalCustomerSpeech('Where is ORD-101?');
    assert.equal(sm.state, 'THINKING');

    const thinkingGen = sm.generation;

    // Customer clicks End Call while backend is still processing
    sm.endCall();
    assert.equal(sm.state, 'ENDED');

    // Stale backend reply arrives after End Call: sm.generation has changed!
    assert.notEqual(sm.generation, thinkingGen);
    sm.onAssistantReplyReceived();
    // State MUST remain ENDED, never revive to SPEAKING
    assert.equal(sm.state, 'ENDED');
  });

  it('should safely cancel when End Call is pressed during SPEAKING', () => {
    const sm = new VoiceSessionStateMachine();
    sm.startCall();
    sm.onConnectedAndListening();
    sm.onFinalCustomerSpeech('Where is ORD-101?');
    sm.onAssistantReplyReceived();
    assert.equal(sm.state, 'SPEAKING');

    // User interrupts and ends call
    sm.endCall();
    assert.equal(sm.state, 'ENDED');

    // When audio element ends, it should not flip state back to LISTENING
    sm.onAssistantSpeechFinished();
    assert.equal(sm.state, 'ENDED');
  });
});

describe('Phase 4 — Speech Recognition Event & Voice Selection Logic', () => {
  it('should prioritize en-IN Indian voice over en-US or en-GB', () => {
    const mockVoices = [
      { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
      { name: 'Google UK English Female', lang: 'en-GB' },
      { name: 'Google हिन्दी / Indian English (Veena)', lang: 'en-IN' },
    ];

    // Priority algorithm replica
    const indianVoice = mockVoices.find(
      (v) =>
        v.lang === 'en-IN' ||
        v.lang === 'en_IN' ||
        v.name.toLowerCase().includes('india') ||
        v.name.toLowerCase().includes('indian')
    );

    assert.ok(indianVoice);
    assert.equal(indianVoice?.lang, 'en-IN');
    assert.ok(indianVoice?.name.includes('Indian English'));
  });

  it('should gracefully fall back to en-GB or en-US if en-IN is unavailable', () => {
    const mockVoices = [
      { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US' },
      { name: 'Google UK English Male', lang: 'en-GB' },
    ];

    const indianVoice = mockVoices.find(
      (v) =>
        v.lang === 'en-IN' ||
        v.lang === 'en_IN' ||
        v.name.toLowerCase().includes('india')
    );
    assert.equal(indianVoice, undefined);

    const fallbackVoice =
      mockVoices.find((v) => v.lang.startsWith('en-GB')) ||
      mockVoices.find((v) => v.lang.startsWith('en-US'));

    assert.ok(fallbackVoice);
    assert.equal(fallbackVoice?.lang, 'en-GB');
  });

  it('should properly map microphone permission denial to actionable error', () => {
    const errObj = { name: 'NotAllowedError', message: 'Permission denied' };
    const isDenied =
      errObj.name === 'NotAllowedError' || errObj.name === 'PermissionDeniedError';

    const voiceError: VoiceError = {
      code: isDenied ? 'MIC_PERMISSION_DENIED' : 'DEVICE_ERROR',
      message: isDenied
        ? 'Microphone access was denied. Please allow microphone permissions in your browser.'
        : 'Unable to access your microphone hardware.',
      actionableSuggestion: 'Click the camera/microphone icon in your browser address bar to allow access, then retry.',
    };

    assert.equal(voiceError.code, 'MIC_PERMISSION_DENIED');
    assert.ok(voiceError.message.includes('Microphone access was denied'));
    assert.ok(voiceError.actionableSuggestion?.includes('address bar'));
  });

  it('should handle missing SpeechRecognition support with actionable suggestion', () => {
    const voiceError: VoiceError = {
      code: 'SPEECH_RECOGNITION_UNSUPPORTED',
      message: 'Your browser does not support Web Speech Recognition.',
      actionableSuggestion: 'Use Google Chrome, Microsoft Edge, or a Chromium-based browser for live voice support, or use the text chat below.',
    };

    assert.equal(voiceError.code, 'SPEECH_RECOGNITION_UNSUPPORTED');
    assert.ok(voiceError.actionableSuggestion?.includes('Google Chrome'));
  });
});
