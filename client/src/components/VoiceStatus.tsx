import type { VoiceState } from '../types/voice';

interface VoiceStatusProps {
  state: VoiceState;
  isMuted?: boolean;
}

export function VoiceStatus({ state, isMuted }: VoiceStatusProps) {
  const stateConfig: Record<
    VoiceState,
    { label: string; badgeBg: string; textColor: string; dotColor: string; animateDot: boolean }
  > = {
    IDLE: {
      label: 'Ready to start call',
      badgeBg: 'bg-gray-100',
      textColor: 'text-gray-700',
      dotColor: 'bg-gray-400',
      animateDot: false,
    },
    INITIALIZING: {
      label: 'Connecting to Aria…',
      badgeBg: 'bg-amber-50 border border-amber-200',
      textColor: 'text-amber-800',
      dotColor: 'bg-amber-500',
      animateDot: true,
    },
    LISTENING: {
      label: isMuted ? 'Microphone Muted' : 'Aria is listening…',
      badgeBg: isMuted ? 'bg-orange-50 border border-orange-200' : 'bg-teal-50 border border-teal-200',
      textColor: isMuted ? 'text-orange-800' : 'text-teal-800',
      dotColor: isMuted ? 'bg-orange-500' : 'bg-teal-600',
      animateDot: !isMuted,
    },
    THINKING: {
      label: 'Aria is thinking…',
      badgeBg: 'bg-teal-50 border border-teal-200',
      textColor: 'text-teal-800',
      dotColor: 'bg-teal-600',
      animateDot: true,
    },
    SPEAKING: {
      label: 'Aria is speaking…',
      badgeBg: 'bg-emerald-50 border border-emerald-200',
      textColor: 'text-emerald-800',
      dotColor: 'bg-emerald-500',
      animateDot: true,
    },
    ENDING: {
      label: 'Ending call…',
      badgeBg: 'bg-gray-100 border border-gray-200',
      textColor: 'text-gray-600',
      dotColor: 'bg-gray-400',
      animateDot: true,
    },
    ENDED: {
      label: 'Call completed',
      badgeBg: 'bg-gray-100',
      textColor: 'text-gray-700',
      dotColor: 'bg-gray-500',
      animateDot: false,
    },
    ERROR: {
      label: 'Voice connection error',
      badgeBg: 'bg-red-50 border border-red-200',
      textColor: 'text-red-700',
      dotColor: 'bg-red-500',
      animateDot: false,
    },
  };

  const config = stateConfig[state];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold ${config.badgeBg} ${config.textColor} shadow-xs transition-all`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {config.animateDot && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dotColor}`} />
      </span>
      <span>{config.label}</span>
    </div>
  );
}
