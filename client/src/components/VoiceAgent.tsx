import { useState, useEffect } from 'react';
import { useVoiceSession } from '../hooks/useVoiceSession';
import { VoiceVisualizer } from './VoiceVisualizer';
import { VoiceStatus } from './VoiceStatus';
import { VoiceControls } from './VoiceControls';
import { VoiceTranscript } from './VoiceTranscript';
import { PostCallDashboard } from './PostCallDashboard';

interface VoiceAgentProps { available?: boolean; catalogMode?: boolean; onSwitchToChat?: () => void; onActiveChange?: (active: boolean) => void; }
export function VoiceAgent({ available = false, catalogMode = false, onSwitchToChat, onActiveChange }: VoiceAgentProps) {
  const voice = useVoiceSession();
  const languageName = voice.language === 'hi' ? 'Hindi' : 'English';
  const [draft, setDraft] = useState('');
  const active = ['INITIALIZING', 'LISTENING', 'THINKING', 'SPEAKING', 'ENDING'].includes(voice.voiceState);
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);
  const guidance = !available ? 'Support is unavailable' : voice.voiceState === 'IDLE' ? 'Ready when you are' : voice.voiceState === 'LISTENING' ? voice.isMuted ? 'Your microphone is muted' : 'Listening to you' : voice.voiceState === 'THINKING' ? 'Let me check that for you' : voice.voiceState === 'SPEAKING' ? 'Aria is speaking' : voice.voiceState === 'ENDED' ? 'Thanks for calling' : 'Connecting your call';
  return <div className="voice-card">
    <header className="agent-header"><div className="agent-identity"><span className="aria-avatar">a.</span><div><h2>Aria <span>AI care specialist</span></h2><p>{catalogMode ? 'Product discovery & availability' : 'Orders, delivery & skincare policies'}</p></div></div>{available ? <VoiceStatus state={voice.voiceState} isMuted={voice.isMuted} /> : <span className="service-status">Unavailable</span>}</header>
    <label className="call-language">Conversation language<select aria-label="Conversation language" disabled={active || voice.isSpeaking} value={voice.language} onChange={event => voice.setLanguage(event.target.value as 'en' | 'hi')}><option value="en">English (India)</option><option value="hi">हिन्दी · Hindi</option></select><span>{active ? 'Say “Speak in Hindi” or “Speak in English”' : 'Choose here, or ask Aria during your call'}</span></label>
    {!voice.isSttSupported && <div className="inline-notice">Voice input works in supported browsers such as Chrome and Edge. You can also type.{!active && <button onClick={onSwitchToChat} className="text-action">Use text chat</button>}</div>}
    {voice.error && <div role="alert" className="inline-notice warning"><p>{voice.error.message}</p>{voice.error.actionableSuggestion && <p>{voice.error.actionableSuggestion}</p>}{voice.voiceState === 'ENDED' && <button onClick={voice.retryPostCall} className="text-action">Retry call summary</button>}</div>}
    {voice.postCallData ? <PostCallDashboard postCallData={voice.postCallData} onStartNewCall={voice.startCall} onUpdatePostCallData={voice.setPostCallData} /> : voice.isLoadingPostCall ? <div className="summary-loading" role="status"><span className="loading-dot" />Preparing your transcript and summary…</div> : <>
      <section className="voice-stage" aria-label="Call controls">
        <VoiceVisualizer state={voice.voiceState} isMuted={voice.isMuted} />
        <h3>{guidance}</h3>
        <p>{!available ? 'Please try again when the service is connected.' : active ? 'Take your time. Aria remembers this conversation.' : 'Start a call, allow your microphone, and speak naturally.'}</p>
        <VoiceControls available={available} state={voice.voiceState} isMuted={voice.isMuted} speechRate={voice.speechRate} onStartCall={voice.startCall} onEndCall={voice.endCall} onToggleMute={voice.toggleMute} onSpeedChange={voice.setSpeechRate} onReset={voice.resetToIdle} />
      </section>
      <div className="conversation-log"><VoiceTranscript transcript={voice.transcript} interimTranscript={voice.interimTranscript} voiceState={voice.voiceState} />
        {active && <form className="voice-type-form" onSubmit={event => { event.preventDefault(); if (!draft.trim() || voice.voiceState !== 'LISTENING') return; void voice.sendTypedMessage(draft); setDraft(''); }}><label htmlFor="voice-message" className="sr-only">Type a message during this call</label><input id="voice-message" value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} disabled={voice.voiceState !== 'LISTENING'} placeholder={voice.voiceState === 'LISTENING' ? 'Or type your message here…' : 'Wait for Aria’s reply…'} /><button type="submit" disabled={!draft.trim() || voice.voiceState !== 'LISTENING'}>Send</button></form>}
      </div>
    </>}
    <details className="audio-settings"><summary>Voice &amp; pronunciation settings</summary><div className="english-voice-settings"><label>{languageName} voice<select aria-label={`${languageName} voice`} disabled={active || voice.isSpeaking} value={voice.selectedVoice ? `${voice.selectedVoice.name}|${voice.selectedVoice.lang}` : ''} onChange={event => voice.chooseVoice(voice.availableVoices.find(item => `${item.name}|${item.lang}` === event.target.value) || null)}>{!voice.availableVoices.length && <option value="">No {languageName} voice available</option>}{voice.availableVoices.map((item, index) => <option key={`${item.voiceURI}-${index}`} value={`${item.name}|${item.lang}`}>{item.name} ({item.lang})</option>)}</select></label><button className="button-secondary" disabled={active || voice.isSpeaking || !voice.availableVoices.length} onClick={voice.previewVoice}>Test {languageName} pronunciation</button></div><p>{voice.selectedVoice ? `${languageName} voice selected.` : `Enable a ${languageName} voice in your browser or operating system to hear Aria.`} {voice.language === 'hi' ? 'Recognition and replies use Hindi. Order IDs stay unchanged in the transcript.' : 'Numbers, prices and order IDs are spoken in English. Indian English is preferred when available.'} Voice input may need an internet connection.</p></details>
  </div>;
}
