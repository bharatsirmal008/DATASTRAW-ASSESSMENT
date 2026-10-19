import { useState, useEffect, useRef, useCallback } from 'react';
import type { VoiceError } from '../types/voice';

// Extend window for WebKit-prefixed SpeechRecognition
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

interface UseSpeechRecognitionOptions {
  language?: string;
  onFinalTranscript?: (transcript: string) => void;
  onError?: (error: VoiceError) => void;
  isMuted?: boolean;
}

export function useSpeechRecognition({
  language = 'en-IN',
  onFinalTranscript,
  onError,
  isMuted = false,
}: UseSpeechRecognitionOptions = {}) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const recognitionRef = useRef<any>(null);
  const recognitionGeneration = useRef(0);
  const permissionRef = useRef(false);
  const pendingFinal = useRef<string[]>([]);
  const finalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManuallyStoppedRef = useRef<boolean>(true);
  const isMutedRef = useRef<boolean>(isMuted);
  const onFinalRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);
  const cancelPending = useCallback(() => {
    if (finalTimer.current) clearTimeout(finalTimer.current);
    finalTimer.current = null;
    pendingFinal.current = [];
  }, []);
  const flushFinal = useCallback(() => {
    if (finalTimer.current) clearTimeout(finalTimer.current);
    finalTimer.current = null;
    const text = pendingFinal.current.join(' ').trim();
    pendingFinal.current = [];
    if (text && !isManuallyStoppedRef.current && !isMutedRef.current) onFinalRef.current?.(text);
  }, []);

  // Keep refs up-to-date
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Feature detection on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as IWindow;
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognitionClass);
    }
  }, []);

  /**
   * Request microphone permission explicitly via getUserMedia
   * and immediately release the audio track so it does not conflict
   * with SpeechRecognition.
   */
  const requestMicrophoneAccess = useCallback(async (): Promise<boolean> => {
    if (permissionRef.current) return true;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return true; // Fallback to SpeechRecognition's native prompt
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop all audio tracks to release the hardware mic
      stream.getTracks().forEach((track) => track.stop());
      setPermissionGranted(true);
      permissionRef.current = true;
      return true;
    } catch (err: any) {
      setPermissionGranted(false);
      permissionRef.current = false;
      const isDenied =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.includes('denied');

      const voiceError: VoiceError = {
        code: isDenied ? 'MIC_PERMISSION_DENIED' : 'DEVICE_ERROR',
        message: isDenied
          ? 'Microphone access was denied. Please allow microphone permissions in your browser.'
          : 'Unable to access your microphone hardware.',
        actionableSuggestion: isDenied
          ? 'Click the camera/microphone icon in your browser address bar to allow access, then retry.'
          : 'Check that your microphone is plugged in and not in use by another application.',
      };

      onErrorRef.current?.(voiceError);
      return false;
    }
  }, []);

  /**
   * Initialize and start speech recognition
   */
  const startListening = useCallback(async (requestedLanguage = language): Promise<boolean> => {
    const generation = ++recognitionGeneration.current;
    cancelPending();
    if (typeof window === 'undefined') return false;

    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      onErrorRef.current?.({
        code: 'SPEECH_RECOGNITION_UNSUPPORTED',
        message: 'Your browser does not support Web Speech Recognition.',
        actionableSuggestion: 'Use Google Chrome, Microsoft Edge, or a Chromium-based browser for live voice support, or use the text chat below.',
      });
      return false;
    }

    // Check mic permission first
    const hasPermission = await requestMicrophoneAccess();
    if (!hasPermission || generation !== recognitionGeneration.current) return false;

    // Clean up any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore abort errors
      }
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = requestedLanguage;
      recognition.maxAlternatives = 1;

      isManuallyStoppedRef.current = false;
      setInterimTranscript('');
      const receivedFinals = new Set<number>();

      recognition.onstart = () => {
        receivedFinals.clear();
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        if (generation !== recognitionGeneration.current || isMutedRef.current || isManuallyStoppedRef.current) {
          return;
        }

        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcriptText = item[0]?.transcript || '';

          if (item.isFinal && !receivedFinals.has(i)) {
            receivedFinals.add(i);
            const cleanText = transcriptText.trim();
            if (cleanText.length > 0) {
              setInterimTranscript('');
              pendingFinal.current.push(cleanText);
            }
          } else if (!item.isFinal) {
            interim += transcriptText;
          }
        }

        if (interim) {
          setInterimTranscript(interim.trim());
        }
        // Browsers often finalize one sentence in several pieces. Wait briefly
        // for the same utterance instead of sending/dropping each fragment.
        if (finalTimer.current) clearTimeout(finalTimer.current);
        if (pendingFinal.current.length && !interim) finalTimer.current = setTimeout(flushFinal, 350);
      };

      recognition.onerror = (event: any) => {
        if (generation !== recognitionGeneration.current || isManuallyStoppedRef.current) return;

        const errorType = event.error;

        // 'no-speech' is a normal transient pause; don't terminate or panic
        if (errorType === 'no-speech') {
          return;
        }

        // 'aborted' is expected when stopping/resetting
        if (errorType === 'aborted') {
          return;
        }

        let err: VoiceError;
        if (errorType === 'not-allowed') {
          permissionRef.current = false;
          err = {
            code: 'MIC_PERMISSION_DENIED',
            message: 'Microphone access was denied.',
            actionableSuggestion: 'Please allow microphone access in your browser settings.',
          };
        } else if (errorType === 'network') {
          err = {
            code: 'NETWORK_ERROR',
            message: 'Network error occurred during speech recognition.',
            actionableSuggestion: 'Please verify your internet connection.',
          };
        } else if (errorType === 'audio-capture') {
          err = {
            code: 'DEVICE_ERROR',
            message: 'No microphone was detected on your system.',
            actionableSuggestion: 'Ensure a working microphone is connected.',
          };
        } else {
          err = {
            code: 'UNKNOWN',
            message: `Speech recognition error: ${errorType}`,
          };
        }

        isManuallyStoppedRef.current = true;
        cancelPending();
        onErrorRef.current?.(err);
      };

      recognition.onend = () => {
        if (generation !== recognitionGeneration.current) return;
        setIsListening(false);
        setInterimTranscript('');
        flushFinal();

        // If not manually stopped, auto-restart to maintain active listening loop
        if (!isManuallyStoppedRef.current && recognitionRef.current === recognition) {
          try {
            recognition.start();
          } catch {
            // Browser might throw if restarted too quickly; safe to catch
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      return true;
    } catch (err: any) {
      setIsListening(false);
      onErrorRef.current?.({
        code: 'UNKNOWN',
        message: err.message || 'Failed to start speech recognition engine.',
      });
      return false;
    }
  }, [language, requestMicrophoneAccess, cancelPending, flushFinal]);

  /**
   * Stop recognition gracefully
   */
  const stopListening = useCallback(() => {
    cancelPending();
    recognitionGeneration.current++;
    isManuallyStoppedRef.current = true;
    setInterimTranscript('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, [cancelPending]);

  /**
   * Abort recognition immediately (e.g. on End Call or Error)
   */
  const abortListening = useCallback(() => {
    cancelPending();
    recognitionGeneration.current++;
    isManuallyStoppedRef.current = true;
    setInterimTranscript('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [cancelPending]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cancelPending();
      recognitionGeneration.current++;
      isManuallyStoppedRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, [cancelPending]);

  return {
    isSupported,
    isListening,
    interimTranscript,
    permissionGranted,
    startListening,
    stopListening,
    abortListening,
    requestMicrophoneAccess,
  };
}
