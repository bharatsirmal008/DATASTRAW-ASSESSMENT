import { useState, useRef, useCallback, useEffect } from 'react';
import type { VoiceState, VoiceError, VoiceTranscriptItem } from '../types/voice';
import type { ProviderMode } from '../types/conversation';
import type { PostCallData } from '../types/summary';
import { createSessionApi, sendMessageApi, endSessionApi, getPostCallApi } from '../services/conversation.api';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSpeechSynthesis } from './useSpeechSynthesis';
import { detectLanguageRequest } from '../utils/languageRequest';

export function useVoiceSession() {
  const [language, setLanguageState] = useState<'en' | 'hi'>('en');
  const languageRef = useRef<'en' | 'hi'>('en');
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [providerMode, setProviderMode] = useState<ProviderMode>('GEMINI');
  const [transcript, setTranscript] = useState<VoiceTranscriptItem[]>([]);
  const [error, setError] = useState<VoiceError | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [postCallData, setPostCallData] = useState<PostCallData | null>(null);
  const [isLoadingPostCall, setIsLoadingPostCall] = useState(false);
  const generation = useRef(0);
  const sessionRef = useRef<string | null>(null);
  const stateRef = useRef<VoiceState>('IDLE');
  const startListeningRef = useRef<(language?: string) => Promise<boolean>>(async () => false);
  const onSpeechRef = useRef<(text: string) => Promise<void>>(async () => {});
  const mounted = useRef(true);
  const transition = useCallback((state: VoiceState) => {
    stateRef.current = state;
    if (mounted.current) setVoiceState(state);
  }, []);
  const reportError = useCallback((message: string) => {
    setError({ code: 'BACKEND_ERROR', message, actionableSuggestion: 'Try again, or use text chat if voice is unavailable.' });
  }, []);
  const speechFinished = useCallback(() => {
    if (stateRef.current === 'SPEAKING') {
      transition('LISTENING');
      void startListeningRef.current(languageRef.current === 'hi' ? 'hi-IN' : 'en-IN');
    }
  }, [transition]);
  const tts = useSpeechSynthesis({ language, onEnd: speechFinished, onError: err => {
    setError({ code: 'SPEECH_SYNTHESIS_UNSUPPORTED', message: err.message });
    if (stateRef.current === 'SPEAKING') {
      speechFinished();
    }
  } });
  const recognition = useSpeechRecognition({ language: language === 'hi' ? 'hi-IN' : 'en-IN', isMuted,
    onFinalTranscript: text => { void onSpeechRef.current(text); },
    onError: voiceError => {
      if (['IDLE', 'ENDED', 'ENDING'].includes(stateRef.current)) return;
      setError(voiceError);
      // Typed input remains usable if the microphone fails mid-call.
      if (stateRef.current !== 'THINKING' && stateRef.current !== 'SPEAKING') transition(sessionRef.current ? 'LISTENING' : 'ERROR');
    },
  });
  const { startListening, abortListening } = recognition;
  const { speak, stopSpeaking } = tts;
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);
  const sendTypedMessage = useCallback(async (text: string) => {
    if (stateRef.current !== 'LISTENING' || !sessionRef.current || !text.trim()) return;
    const token = generation.current;
    const id = sessionRef.current;
    const requestedLanguage = detectLanguageRequest(text) || languageRef.current;
    languageRef.current = requestedLanguage;
    setLanguageState(requestedLanguage);
    transition('THINKING');
    abortListening();
    setError(null);
    setTranscript(previous => [...previous, { id: crypto.randomUUID(), speaker: 'customer', text: text.trim(), timestamp: new Date().toLocaleTimeString() }]);
    try {
      const result = await sendMessageApi(id, text.trim(), requestedLanguage);
      if (token !== generation.current || !mounted.current) return;
      setProviderMode(result.mode);
      setTranscript(previous => [...previous, { id: crypto.randomUUID(), speaker: 'aria', text: result.response, timestamp: new Date().toLocaleTimeString(), toolCalls: result.toolCalls }]);
      if (tts.isSupported) { transition('SPEAKING'); await speak(result.response, requestedLanguage); }
      else { transition('LISTENING'); void startListeningRef.current(requestedLanguage === 'hi' ? 'hi-IN' : 'en-IN'); }
    } catch (err) {
      if (token !== generation.current || !mounted.current) return;
      reportError(err instanceof Error ? err.message : 'Could not send your message.');
      transition('LISTENING');
      void startListeningRef.current(languageRef.current === 'hi' ? 'hi-IN' : 'en-IN');
    }
  }, [transition, abortListening, tts.isSupported, speak, reportError]);
  useEffect(() => { onSpeechRef.current = sendTypedMessage; }, [sendTypedMessage]);
  const startCall = useCallback(async () => {
    if (!['IDLE', 'ENDED', 'ERROR'].includes(stateRef.current)) return;
    const token = ++generation.current;
    transition('INITIALIZING');
    abortListening(); stopSpeaking();
    setError(null); setTranscript([]); setPostCallData(null); setIsMuted(false);
    sessionRef.current = null; setSessionId(null);
    try {
      const session = await createSessionApi();
      if (token !== generation.current || !mounted.current) {
        void endSessionApi(session.id).catch(() => {});
        return;
      }
      sessionRef.current = session.id; setSessionId(session.id);
      const started = await startListening();
      if (token !== generation.current || !mounted.current) { abortListening(); return; }
      transition('LISTENING');
      if (!started) setError({ code: 'MIC_PERMISSION_DENIED', message: 'Voice input is unavailable. You can type below to continue this call.', actionableSuggestion: 'Allow microphone access and start a new call to retry voice input.' });
    } catch (err) {
      if (token !== generation.current || !mounted.current) return;
      reportError(err instanceof Error ? err.message : 'Could not start the call.'); transition('ERROR');
    }
  }, [transition, abortListening, stopSpeaking, startListening, reportError]);
  const retryPostCall = useCallback(async () => {
    if (!sessionRef.current) return;
    const token = generation.current;
    setIsLoadingPostCall(true); setError(null);
    try {
      await endSessionApi(sessionRef.current);
      const data = await getPostCallApi(sessionRef.current);
      if (mounted.current && token === generation.current) setPostCallData(data);
    } catch (err) {
      if (mounted.current && token === generation.current) reportError(err instanceof Error ? err.message : 'Could not load the call summary.');
    } finally {
      if (mounted.current && token === generation.current) setIsLoadingPostCall(false);
    }
  }, [reportError]);
  const endCall = useCallback(async () => {
    if (['IDLE', 'ENDED', 'ENDING'].includes(stateRef.current)) return;
    ++generation.current; transition('ENDING'); abortListening(); stopSpeaking();
    await retryPostCall();
    transition('ENDED');
  }, [transition, abortListening, stopSpeaking, retryPostCall]);
  const loadCompletedCall = useCallback(async (id: string) => {
    if (!['IDLE', 'ENDED', 'ERROR'].includes(stateRef.current)) return;
    setIsLoadingPostCall(true);
    try {
      const data = await getPostCallApi(id);
      sessionRef.current = id; setSessionId(id); setPostCallData(data); transition('ENDED');
    } catch (err) { reportError(err instanceof Error ? err.message : 'Could not load this call.'); }
    finally { setIsLoadingPostCall(false); }
  }, [transition, reportError]);
  const resetToIdle = useCallback(() => {
    ++generation.current; abortListening(); stopSpeaking(); setError(null); transition('IDLE');
    const id = sessionRef.current;
    if (id) void endSessionApi(id).catch(() => {});
    sessionRef.current = null; setSessionId(null);
  }, [abortListening, stopSpeaking, transition]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; ++generation.current; abortListening(); stopSpeaking();
      const id = sessionRef.current;
      if (id) void endSessionApi(id).catch(() => {});
    };
  }, [abortListening, stopSpeaking]);
  return { voiceState, sessionId, providerMode, transcript, interimTranscript: recognition.interimTranscript, error, isMuted,
    language, setLanguage: (value: 'en' | 'hi') => { if (['IDLE', 'ENDED', 'ERROR'].includes(stateRef.current) && !tts.isSpeaking) { setError(null); languageRef.current = value; setLanguageState(value); } },
    isListening: recognition.isListening, isSpeaking: tts.isSpeaking, isSttSupported: recognition.isSupported, isTtsSupported: tts.isSupported,
    selectedVoice: tts.selectedVoice, isIndianVoice: tts.isIndianVoice, speechRate: tts.speechRate, setSpeechRate: tts.setSpeechRate,
    availableVoices: tts.availableVoices, chooseVoice: tts.chooseVoice,
    previewVoice: () => { if (['IDLE', 'ENDED', 'ERROR'].includes(stateRef.current)) { setError(null); void tts.speak(language === 'hi' ? 'नमस्ते, मैं आरिया हूँ। आपका ऑर्डर ORD-101, ₹699 का है और शाम 6 बजे तक आने की उम्मीद है।' : 'Order ORD-101 costs ₹699 and is expected by 6 PM.'); } },
    postCallData, setPostCallData, isLoadingPostCall, loadCompletedCall, startCall, endCall, resetToIdle, retryPostCall, sendTypedMessage,
    toggleMute: () => setIsMuted(value => !value) };
}
