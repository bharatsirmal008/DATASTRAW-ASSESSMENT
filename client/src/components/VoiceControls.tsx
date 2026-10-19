import type { VoiceState } from '../types/voice';

interface VoiceControlsProps {
  available?: boolean; state: VoiceState; isMuted: boolean; speechRate: number;
  onStartCall: () => void; onEndCall: () => void; onToggleMute: () => void;
  onSpeedChange: (speed: number) => void; onReset: () => void;
}

export function VoiceControls({ available = true, state, isMuted, speechRate, onStartCall, onEndCall, onToggleMute, onSpeedChange, onReset }: VoiceControlsProps) {
  const active = ['INITIALIZING', 'LISTENING', 'THINKING', 'SPEAKING', 'ENDING'].includes(state);
  return <div className="call-controls">
    <div className="call-actions">
      {active ? <button className="button-end" onClick={onEndCall} disabled={state === 'ENDING'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 14c4-5 12-5 16 0M4 14v4h4v-4m12 0v4h-4v-4" /></svg>{state === 'ENDING' ? 'Ending call…' : 'End Call'}</button> : <button className="button-primary" onClick={onStartCall} disabled={!available}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2Z" /></svg>{state === 'ENDED' ? 'Start another call' : 'Start Voice Call'}</button>}
      {active && <button className="button-secondary" aria-pressed={isMuted} onClick={onToggleMute}>{isMuted ? 'Unmute' : 'Mute'}</button>}
      {state === 'ERROR' && <button className="button-secondary" onClick={onReset}>Reset</button>}
    </div>
    <label className="speech-speed">Speaking speed <select aria-label="Speaking speed" value={speechRate} onChange={event => onSpeedChange(Number(event.target.value))}><option value={0.9}>Slower · 0.9×</option><option value={1}>Normal · 1×</option><option value={1.15}>Faster · 1.15×</option></select></label>
  </div>;
}
