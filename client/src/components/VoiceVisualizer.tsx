import type { VoiceState } from '../types/voice';

export function VoiceVisualizer({ state, isMuted = false }: { state: VoiceState; isMuted?: boolean }) {
  return <div className={`voice-orb state-${state.toLowerCase()}${isMuted ? ' is-muted' : ''}`} aria-hidden="true">
    <span className="orb-ring" />
    <div className="orb-core">
      {state === 'SPEAKING' ? <div className="orb-wave">{[0, 1, 2, 3, 4].map(value => <i key={value} style={{ animationDelay: `${value * 100}ms` }} />)}</div> : <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />{isMuted && <path d="m3 3 18 18" />}</svg>}
    </div>
  </div>;
}
