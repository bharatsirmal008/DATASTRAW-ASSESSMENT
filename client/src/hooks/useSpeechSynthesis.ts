import { useState, useEffect, useRef, useCallback } from 'react';
import { sanitizeTextForSpeech, sanitizeHindiSpeech, matchesSpeechLanguage, selectSpeechVoice, type SpeechLanguage } from '../utils/speech';
export { sanitizeTextForSpeech } from '../utils/speech';

interface UseSpeechSynthesisOptions { language?: SpeechLanguage; defaultRate?: number; onStart?: () => void; onEnd?: () => void; onError?: (err: Error) => void; }

export function useSpeechSynthesis({ language = 'en', defaultRate = 1, onStart, onEnd, onError }: UseSpeechSynthesisOptions = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speechRate, setSpeechRate] = useState(defaultRate);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const activeRef = useRef<{ utterance: SpeechSynthesisUtterance; finish: (cancelled?: boolean) => void } | null>(null);
  const callbacks = useRef({ onStart, onEnd, onError });
  useEffect(() => { callbacks.current = { onStart, onEnd, onError }; }, [onStart, onEnd, onError]);
  const chooseVoice = useCallback((voice: SpeechSynthesisVoice | null) => {
    voiceRef.current = voice && matchesSpeechLanguage(voice, language) ? voice : null;
    setSelectedVoice(voiceRef.current);
  }, [language]);
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setIsSupported(true);
    const synth = window.speechSynthesis;
    const update = () => {
      const voices = synth.getVoices().filter(voice => matchesSpeechLanguage(voice, language));
      setAvailableVoices(voices);
      chooseVoice(voices.find(voice => voice.voiceURI === voiceRef.current?.voiceURI && voice.name === voiceRef.current?.name) || selectSpeechVoice(voices, language));
    };
    update();
    synth.addEventListener('voiceschanged', update);
    return () => synth.removeEventListener('voiceschanged', update);
  }, [chooseVoice, language]);
  const stopSpeaking = useCallback(() => {
    const active = activeRef.current;
    // Some browser voices do not fire an end/error event after cancel().
    active?.finish(true);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);
  const speak = useCallback((text: string, requestedLanguage: SpeechLanguage = language): Promise<void> => new Promise(resolve => {
    const requestedName = requestedLanguage === 'hi' ? 'Hindi' : 'English';
    stopSpeaking();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { resolve(); return; }
    const synth = window.speechSynthesis;
    const voice = voiceRef.current && matchesSpeechLanguage(voiceRef.current, requestedLanguage) ? voiceRef.current : selectSpeechVoice(synth.getVoices(), requestedLanguage);
    if (!voice) {
      callbacks.current.onError?.(new Error(`No ${requestedName} speech voice is available. Enable a ${requestedName} voice in your browser or operating system, or continue by text.`));
      resolve(); return;
    }
    const spokenText = requestedLanguage === 'hi' ? sanitizeHindiSpeech(text) : sanitizeTextForSpeech(text);
    if (!spokenText) { callbacks.current.onEnd?.(); resolve(); return; }
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.voice = voice;
    utterance.lang = voice.lang.replace('_', '-');
    utterance.rate = speechRate;
    utterance.pitch = 1;
    let finished = false;
    const finish = (cancelled = false) => {
      if (finished) return;
      finished = true;
      if (activeRef.current?.utterance === utterance) activeRef.current = null;
      setIsSpeaking(false);
      if (!cancelled) callbacks.current.onEnd?.();
      resolve();
    };
    activeRef.current = { utterance, finish };
    utterance.onstart = () => { if (!finished) { setIsSpeaking(true); callbacks.current.onStart?.(); } };
    utterance.onend = () => finish();
    utterance.onerror = event => {
      if (finished) return;
      if (event.error === 'canceled' || event.error === 'interrupted') { finish(true); return; }
      callbacks.current.onError?.(new Error(`${requestedName} audio playback failed (${event.error}). You can read the reply and continue by typing.`));
      finish();
    };
    try { synth.speak(utterance); }
    catch { callbacks.current.onError?.(new Error(`${requestedName} audio playback could not start. Continue by text.`)); finish(); }
  }), [speechRate, stopSpeaking, language]);
  useEffect(() => () => { activeRef.current?.finish(true); if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  return { isSupported, isSpeaking, availableVoices, selectedVoice, isIndianVoice: !!selectedVoice && /^en[-_]IN$/i.test(selectedVoice.lang), speechRate, setSpeechRate, speak, stopSpeaking, chooseVoice };
}
