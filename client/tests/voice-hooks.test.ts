import { beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { useVoiceSession } from '../src/hooks/useVoiceSession';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const originalFetch = globalThis.fetch;
let requests: string[];
let failedSummary: boolean;
let denyMicrophone: boolean;
let delayedMessage: ((value: Response) => void) | null;
let delayMessage: boolean;
let utterance: any;
let holdSpeech: boolean;
let voices: Array<{ name: string; lang: string }>;
let spokenAnswer: string;
let microphoneRequests: number;
let sentMessages: string[];
let sentLanguages: string[];
let emitCancel: boolean;
class Recognition {
  static current: Recognition;
  onstart?: () => void;
  onresult?: (event: any) => void;
  onend?: () => void;
  constructor() { Recognition.current = this; }
  start() { this.onstart?.(); }
  abort() {}
  stop() {}
}
class Utterance { constructor(public text: string) {} }
const session = { id: 'assessment-call', status: 'ACTIVE', messages: [], context: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
const postCall = { session: { ...session, status: 'ENDED' }, transcript: { messages: [], plainText: '' }, summary: { summary_mode: 'GEMINI' }, analytics: {}, mode: 'GEMINI' };
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ success: status < 400, data, error: status >= 400 ? { message: 'AI quota reached' } : undefined }), { status, headers: { 'Content-Type': 'application/json' } });
const answer = () => response({ session, response: spokenAnswer, toolCalls: [], mode: 'GEMINI' });

beforeEach(() => {
  requests = []; failedSummary = false; denyMicrophone = false; delayMessage = false; delayedMessage = null; utterance = null; holdSpeech = false;
  voices = [{ name: 'Indian English', lang: 'en-IN' }];
  spokenAnswer = 'Your order is out for delivery.'; microphoneRequests = 0; sentMessages = []; emitCancel = true;
  sentLanguages = [];
  Object.assign(dom.window, { SpeechRecognition: Recognition, speechSynthesis: {
    getVoices: () => voices, addEventListener() {}, removeEventListener() {},
    cancel() { const current = utterance; utterance = null; if (emitCancel) current?.onerror?.({ error: 'canceled' }); },
    speak(value: any) { utterance = value; value.onstart?.(); if (!holdSpeech) queueMicrotask(() => value.onend?.()); },
  } });
  Object.assign(globalThis, { SpeechSynthesisUtterance: Utterance });
  Object.defineProperty(dom.window.navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
    microphoneRequests++;
    if (denyMicrophone) throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    return { getTracks: () => [{ stop() {} }] };
  } } });
  globalThis.fetch = async (input, init) => {
    const url = String(input); requests.push(url);
    if (url.endsWith('/messages')) {
      sentMessages.push(JSON.parse(String(init?.body)).message);
      sentLanguages.push(JSON.parse(String(init?.body)).language);
      if (delayMessage) return new Promise(resolve => { delayedMessage = resolve; });
      return answer();
    }
    if (url.endsWith('/end')) return failedSummary ? response(null, 429) : response({ session: postCall.session });
    if (url.endsWith('/postcall')) return response(postCall);
    return response({ session });
  };
});
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

it('actual voice hook prevents duplicate starts and selects an Indian voice', async () => {
  const { result } = renderHook(() => useVoiceSession());
  await act(async () => { await Promise.all([result.current.startCall(), result.current.startCall()]); });
  assert.equal(requests.filter(url => url.endsWith('/sessions')).length, 1);
  assert.equal(result.current.voiceState, 'LISTENING');
  assert.equal(result.current.selectedVoice?.lang, 'en-IN');
});

it('actual voice hook keeps typed support usable after microphone permission denial', async () => {
  denyMicrophone = true;
  const { result } = renderHook(() => useVoiceSession());
  await act(async () => { await result.current.startCall(); });
  assert.equal(result.current.voiceState, 'LISTENING');
  assert.equal(result.current.error?.code, 'MIC_PERMISSION_DENIED');
  await act(async () => { await result.current.sendTypedMessage('Where is ORD-101?'); });
  assert.equal(result.current.transcript.length, 2);
});

it('actual voice hook ignores a provider reply arriving after End Call', async () => {
  delayMessage = true;
  const { result } = renderHook(() => useVoiceSession());
  await act(async () => { await result.current.startCall(); });
  let pending!: Promise<void>;
  act(() => { pending = result.current.sendTypedMessage('Where is ORD-101?'); });
  await waitFor(() => assert.equal(result.current.voiceState, 'THINKING'));
  await act(async () => { await result.current.endCall(); });
  assert.equal(result.current.voiceState, 'ENDED');
  await act(async () => { delayedMessage!(answer()); await pending; });
  assert.equal(result.current.voiceState, 'ENDED');
  assert.equal(result.current.transcript.length, 1);
});

it('actual voice hook stops speech on End Call without reopening the microphone', async () => {
  holdSpeech = true;
  const { result } = renderHook(() => useVoiceSession());
  await act(async () => { await result.current.startCall(); });
  let pending!: Promise<void>;
  act(() => { pending = result.current.sendTypedMessage('Track ORD-101'); });
  await waitFor(() => assert.equal(result.current.voiceState, 'SPEAKING'));
  await act(async () => { await result.current.endCall(); await pending; });
  assert.equal(result.current.voiceState, 'ENDED');
  assert.equal(result.current.isSpeaking, false);
});

it('actual voice hook preserves the transcript on summary failure and supports retry', async () => {
  const { result } = renderHook(() => useVoiceSession());
  await act(async () => { await result.current.startCall(); await result.current.sendTypedMessage('Track ORD-101'); });
  failedSummary = true;
  await act(async () => { await result.current.endCall(); });
  assert.equal(result.current.voiceState, 'ENDED');
  assert.equal(result.current.transcript.length, 2);
  assert.match(result.current.error!.message, /quota/);
  failedSummary = false;
  await act(async () => { await result.current.retryPostCall(); });
  assert.equal(result.current.postCallData?.mode, 'GEMINI');
  assert.equal(result.current.error, null);
});

it('speaks prices and IDs in English even with a Hindi India voice listed first', async () => {
  voices = [{ name: 'Hindi India', lang: 'hi-IN' }, { name: 'Indian English', lang: 'en-IN' }];
  spokenAnswer = 'ORD-101 costs ₹६९९ and arrives by 6 PM.';
  const { result } = renderHook(() => useVoiceSession());
  await act(async () => { await result.current.startCall(); await result.current.sendTypedMessage('Price?'); });
  assert.equal(utterance.voice.lang, 'en-IN');
  assert.equal(utterance.lang, 'en-IN');
  assert.equal(utterance.text, 'O R D one zero one costs six hundred and ninety nine rupees and arrives by six P M.');
  assert.equal(result.current.transcript[1].text, spokenAnswer);
});

it('reports missing English voices instead of silently speaking Hindi', async () => {
  voices = [{ name: 'Hindi India', lang: 'hi-IN' }];
  const { result } = renderHook(() => useVoiceSession());
  await act(async () => { await result.current.startCall(); await result.current.sendTypedMessage('Hi'); });
  assert.equal(utterance, null);
  assert.equal(result.current.voiceState, 'LISTENING');
  assert.match(result.current.error!.message, /No English speech voice/);
});

it('joins speech fragments into one question and ignores repeated final events', async () => {
  const { result } = renderHook(() => useVoiceSession());
  await act(async () => { await result.current.startCall(); });
  const engine = Recognition.current;
  const first = Object.assign([{ transcript: 'Where is' }], { isFinal: true });
  const second = Object.assign([{ transcript: 'my order O R D one zero one?' }], { isFinal: true });
  act(() => { engine.onresult!({ resultIndex: 0, results: [first] }); engine.onresult!({ resultIndex: 1, results: [first, second] }); engine.onresult!({ resultIndex: 0, results: [first, second] }); });
  await waitFor(() => assert.equal(result.current.transcript.length, 2));
  assert.deepEqual(sentMessages, ['Where is my order O R D one zero one?']);
  assert.equal(microphoneRequests, 1, 'Do not reacquire media permission after each response');
});

it('does not send a pending speech fragment after End Call', async () => {
  const { result } = renderHook(() => useVoiceSession());
  await act(async () => { await result.current.startCall(); });
  act(() => Recognition.current.onresult!({ resultIndex: 0, results: [Object.assign([{ transcript: 'Where is my order?' }], { isFinal: true })] }));
  await act(async () => { await result.current.endCall(); await new Promise(resolve => setTimeout(resolve, 400)); });
  assert.deepEqual(sentMessages, []);
  assert.equal(result.current.voiceState, 'ENDED');
});

it('finishes cancelling speech even when the browser emits no cancellation event', async () => {
  holdSpeech = true; emitCancel = false;
  const { result } = renderHook(() => useVoiceSession());
  await act(async () => { await result.current.startCall(); });
  let pending!: Promise<void>;
  act(() => { pending = result.current.sendTypedMessage('Track my order'); });
  await waitFor(() => assert.equal(result.current.voiceState, 'SPEAKING'));
  await act(async () => { await result.current.endCall(); await pending; });
  assert.equal(result.current.voiceState, 'ENDED');
});

it('switches recognition, request language and speech to Hindi while retaining English as default', async () => {
  voices = [{ name: 'Hindi', lang: 'hi-IN' }, { name: 'English', lang: 'en-IN' }];
  spokenAnswer = 'आपका ऑर्डर ORD-101 आज शाम 6 PM तक आएगा।';
  const { result } = renderHook(() => useVoiceSession());
  assert.equal(result.current.language, 'en');
  act(() => result.current.setLanguage('hi'));
  assert.equal(result.current.selectedVoice?.lang, 'hi-IN');
  await act(async () => { await result.current.startCall(); await result.current.sendTypedMessage('मेरा ऑर्डर कहाँ है?'); });
  assert.equal((Recognition.current as any).lang, 'hi-IN');
  assert.deepEqual(sentLanguages, ['hi']);
  assert.equal(utterance.lang, 'hi-IN');
  assert.match(utterance.text, /ओ आर डी एक शून्य एक/);
  act(() => result.current.setLanguage('en'));
  assert.equal(result.current.language, 'hi', 'Do not change language in an active call');
  await act(async () => { await result.current.endCall(); });
  act(() => result.current.setLanguage('en'));
  assert.equal(result.current.selectedVoice?.lang, 'en-IN');
});

it('retains Hindi text and reports a missing Hindi voice instead of using English audio', async () => {
  voices = [{ name: 'English', lang: 'en-IN' }];
  spokenAnswer = 'आपका ऑर्डर रास्ते में है।';
  const { result } = renderHook(() => useVoiceSession());
  act(() => result.current.setLanguage('hi'));
  await act(async () => { await result.current.startCall(); await result.current.sendTypedMessage('मेरा ऑर्डर कहाँ है?'); });
  assert.equal(utterance, null);
  assert.match(result.current.error!.message, /No Hindi speech voice/);
  assert.equal(result.current.transcript[1].text, spokenAnswer);
});

it('switches both ways by conversation without ending or replacing the current session', async () => {
  voices = [{ name: 'Hindi', lang: 'hi-IN' }, { name: 'English', lang: 'en-IN' }];
  const { result } = renderHook(() => useVoiceSession());
  await act(async () => { await result.current.startCall(); });
  const id = result.current.sessionId;
  spokenAnswer = 'हाँ, हम हिंदी में बात कर सकते हैं।';
  act(() => Recognition.current.onresult!({ resultIndex: 0, results: [Object.assign([{ transcript: 'Can you talk in Hindi?' }], { isFinal: true })] }));
  await waitFor(() => assert.equal(result.current.transcript.length, 2));
  assert.equal(result.current.language, 'hi');
  assert.equal(result.current.sessionId, id);
  assert.equal(utterance.lang, 'hi-IN');
  assert.equal((Recognition.current as any).lang, 'hi-IN');
  spokenAnswer = 'Your order is out for delivery.';
  await act(async () => { await result.current.sendTypedMessage('मेरा ऑर्डर कहाँ है?'); });
  assert.equal(result.current.language, 'hi');
  spokenAnswer = 'Yes, we can continue in English.';
  await act(async () => { await result.current.sendTypedMessage('Speak in English please'); });
  assert.equal(result.current.language, 'en');
  assert.equal(utterance.lang, 'en-IN');
  assert.equal((Recognition.current as any).lang, 'en-IN');
  assert.equal(result.current.sessionId, id);
  assert.deepEqual(sentLanguages, ['hi', 'hi', 'en']);
  assert.equal(requests.filter(url => url.endsWith('/sessions')).length, 1);
  assert.equal(result.current.transcript.length, 6);
});
