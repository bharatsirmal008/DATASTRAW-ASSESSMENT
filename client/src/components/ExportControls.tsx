import { useState } from 'react';
import type { PostCallData } from '../types/summary';

interface ExportControlsProps {
  postCallData: PostCallData;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function ExportControls({ postCallData }: ExportControlsProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const handleDownloadTranscript = () => {
    const filename = `transcript-${sanitizeFilename(postCallData.session.id)}.txt`;
    const blob = new Blob([postCallData.transcript.plainText], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSummary = () => {
    const filename = `summary-${sanitizeFilename(postCallData.session.id)}.json`;
    const exportPayload = {
      session: {
        id: postCallData.session.id,
        createdAt: postCallData.session.createdAt,
        endedAt: postCallData.session.endedAt,
      },
      outcome: postCallData.summary,
      analytics: postCallData.analytics,
      transcript: postCallData.transcript.messages,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(postCallData.transcript.plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* Download Transcript TXT */}
      <button
        onClick={handleDownloadTranscript}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold border border-teal-200 transition cursor-pointer shadow-xs"
        title="Download human-readable plain text transcript"
      >
        <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        <span>Download Transcript (.txt)</span>
      </button>

      {/* Download Summary JSON */}
      <button
        onClick={handleDownloadSummary}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold border border-teal-200 transition cursor-pointer shadow-xs"
        title="Download structured JSON summary and analytics"
      >
        <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
        </svg>
        <span>Download Summary (.json)</span>
      </button>

      {/* Copy Transcript */}
      <button
        onClick={handleCopyTranscript}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-semibold border border-gray-200 transition cursor-pointer shadow-xs"
        title="Copy transcript text to clipboard"
      >
        {copied ? (
          <>
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <span className="text-emerald-700">Copied!</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
            </svg>
            <span>Copy Text</span>
          </>
        )}
      </button>
    </div>
  );
}
