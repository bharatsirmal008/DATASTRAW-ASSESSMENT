# Phase 4 — Browser-Based Real-Time Voice Conversation

## 1. Overview & Objectives

Phase 4 introduces an interactive, real-time voice conversation layer for **Aria**, the AI customer support specialist for **Aura Skincare**.

Evaluators can now:
1. Open the local application in their browser (`http://localhost:5173`).
2. Click **Start Voice Call** to request microphone permission and connect to Aria.
3. Speak naturally in Indian English (e.g. *"Where is my order ORD-101?"*).
4. See live interim words as they speak, followed by committed customer dialogue.
5. Watch Aria enter the **Thinking** state while querying verified backend order and policy tools.
6. Hear Aria speak her response aloud in an Indian English voice (or best available system voice).
7. Ask multi-turn follow-up questions (e.g. *"Can I cancel it?"*) with context retained in the same backend session.
8. Click **End Call** at any time to immediately stop audio playback and speech recognition, preserving the complete chronological transcript on screen.

All voice interactions run locally using the existing **Phase 3 DEMO provider** with zero external API keys. When Google Gemini or cloud voice services are configured in the future, the exact same voice engine automatically interfaces with them without requiring any client rewrites.

---

## 2. Voice Architecture & Browser APIs

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Browser Environment                            │
├────────────────────────────────────────────────────────────────────────┤
│  [Customer Microphone]                                                 │
│          │                                                             │
│          ▼                                                             │
│  Web Speech API: SpeechRecognition (en-IN)                             │
│    • Interim text displayed in real-time                               │
│    • Finalized speech submitted to Voice State Machine                 │
│          │                                                             │
│          ▼                                                             │
│  useVoiceSession Hook (State Machine & Generation Guards)              │
│    • States: IDLE → INITIALIZING → LISTENING → THINKING → SPEAKING     │
│    • Protects against rapid clicks, aborted turns, and stale callbacks │
│          │                                                             │
│          ▼                                                             │
│  Phase 3 Conversation API                                              │
│    • POST /api/conversations/sessions (Session initialization)         │
│    • POST /api/conversations/sessions/:id/messages (Turn execution)    │
│    • POST /api/conversations/sessions/:id/end (Session termination)    │
│          │                                                             │
│          ▼                                                             │
│  Speech Synthesis Text Sanitizer (`sanitizeTextForSpeech`)             │
│    • Strips markdown asterisks, bullets, links, and code markers       │
│          │                                                             │
│          ▼                                                             │
│  Web Speech API: SpeechSynthesis (en-IN priority + fallback)           │
│    • Natural pacing and user-configurable speech speed (0.9x-1.15x)    │
│    • Immediate cancellation upon "End Call"                            │
│          │                                                             │
│          ▼                                                             │
│  [Audio Speaker Playback] → Once complete, resumes LISTENING           │
└────────────────────────────────────────────────────────────────────────┘
```

### Technology & API Choices
- **Speech Recognition:** Standard W3C `SpeechRecognition` with Chromium fallback `webkitSpeechRecognition`. Continuous listening with interim results enabled and `lang = 'en-IN'`.
- **Speech Synthesis:** Standard W3C `window.speechSynthesis` with `SpeechSynthesisUtterance`. Automated voice discovery listening to `voiceschanged` to locate Indian English voices (`en-IN`).
- **No Paid SDKs / Zero External Setup:** Completely standard Web platform capabilities requiring zero external account creation, zero credit cards, and zero API secrets.

---

## 3. Voice State Machine & Lifecycle Transitions

To eliminate contradictory or invalid states, the voice interaction is governed by a typed state machine:

```
        ┌────────────────────────────────────────────────┐
        │                                                │
        ▼                                                │
     [ IDLE ] ──(Click "Start Call")──► [ INITIALIZING ] │
                                                │        │
                                   (Session Created &    │
                                    Mic Permitted)       │
                                                ▼        │
 ┌─► [ LISTENING ] ◄──(Speech Playback Complete)── [ SPEAKING ]
 │          │                                            ▲
 │   (Finalized Speech)                                  │
 │          │                                    (Backend Reply)
 │          ▼                                            │
 └─── [ THINKING ] ──────────────────────────────────────┘
            │
            ├────────(Click "End Call" at Any Time)──────┐
            ▼                                            ▼
      [ ENDING ] ────────────────────────────────► [ ENDED ]
            │                                            ▲
            └────────(Recoverable Voice Error)───────────┤
                                                         │
                                                   [ ERROR ]
```

### State Definitions
| State | Label on UI | Description |
| :--- | :--- | :--- |
| **`IDLE`** | *Ready to start call* | Initial quiescent state; microphone is off; Start Call is enabled. |
| **`INITIALIZING`** | *Connecting to Aria…* | Requesting microphone permissions and creating backend session. |
| **`LISTENING`** | *Aria is listening…* | Microphone active; customer speech recognized; pulsing lavender visualizer. |
| **`THINKING`** | *Aria is thinking…* | Customer speech finalized; recognition paused; backend order/policy tools executing. |
| **`SPEAKING`** | *Aria is speaking…* | Assistant audio playing through browser speakers; animated equalizer bars. |
| **`ENDING`** | *Ending call…* | Cancellation in progress; speech and recognition aborted; backend session closed. |
| **`ENDED`** | *Call completed* | Call terminated; final transcript retained on screen; Start Call re-enabled. |
| **`ERROR`** | *Voice connection error* | Recoverable issue (e.g. mic permission denied, device error) with actionable retry advice. |

---

## 4. Hook Specifications

### 1. `useSpeechRecognition.ts`
Located at [`client/src/hooks/useSpeechRecognition.ts`](file:///d:/aura-ai-voice-agent/client/src/hooks/useSpeechRecognition.ts).
- **Explicit Permission Handling:** Calls `navigator.mediaDevices.getUserMedia({ audio: true })` strictly during user-initiated Start Call, immediately closing tracks so hardware microphone stream is released for the SpeechRecognition engine.
- **Language:** Defaults to `en-IN` (Indian English).
- **Interim Speech:** Accumulates `event.results` into `interimTranscript` for live visual feedback without triggering premature backend submissions.
- **Finalized Speech:** When `item.isFinal` is true and text contains non-whitespace characters, triggers `onFinalTranscript(cleanText)` and clears interim state.
- **Mute Functionality:** When `isMuted` is active, incoming speech results are suppressed.
- **Error Mapping:** Converts browser errors (`not-allowed`, `no-speech`, `audio-capture`, `network`) into typed `VoiceError` objects with user-friendly recovery instructions.
- **Cleanup:** Aborts recognition cleanly on stop, unmount, and session termination.

### 2. `useSpeechSynthesis.ts`
Located at [`client/src/hooks/useSpeechSynthesis.ts`](file:///d:/aura-ai-voice-agent/client/src/hooks/useSpeechSynthesis.ts).
- **Text Sanitization (`sanitizeTextForSpeech`):** Strips markdown asterisks, bullet points (`•`), URL markdown links, and redundant scenario markers so Aria reads pure, fluent English without uttering syntax symbols.
- **Voice Discovery:** Attaches to the `voiceschanged` event. Scans for voices matching `lang === 'en-IN'` or names containing "India" / "Indian" (e.g., Google हिन्दी, Veena, Heera). Falls back gracefully to `en-GB`, `en-US`, or default system voice without falsifying accent capabilities.
- **Speed Adjustment:** Allows fine-tuning speech rate (0.9x, 1.0x, 1.15x) for natural pacing.
- **Overlap Prevention:** Calls `window.speechSynthesis.cancel()` prior to speaking to prevent overlapping utterances.
- **Instant Cancellation:** Immediately halts speech if the customer clicks **End Call**.

### 3. `useVoiceSession.ts`
Located at [`client/src/hooks/useVoiceSession.ts`](file:///d:/aura-ai-voice-agent/client/src/hooks/useVoiceSession.ts).
- **Orchestration:** Seamlessly wires `useSpeechRecognition`, `useSpeechSynthesis`, and the Phase 3 Conversation API.
- **Token Guards & Race Condition Defenses:** Uses an incrementing generation counter (`generationRef`). If the user clicks **End Call** while Aria is thinking or speaking, late asynchronous HTTP responses or synthesis completions are safely discarded and never restart the call.
- **Echo Suppression:** Speech recognition is stopped while Aria is speaking, eliminating self-listening audio feedback loops. Recognition automatically resumes once playback completes.
- **Context Retention:** Reuses the exact same backend session UUID throughout the entire call.

---

## 5. UI Components

- **[`VoiceAgent.tsx`](file:///d:/aura-ai-voice-agent/client/src/components/VoiceAgent.tsx):** Master voice container featuring Aura Skincare branding (ivory surfaces, lavender gradients, rounded cards), provider status badge, language badge, and evaluator query hints.
- **[`VoiceVisualizer.tsx`](file:///d:/aura-ai-voice-agent/client/src/components/VoiceVisualizer.tsx):** Dynamic centerpiece with CSS-driven state visuals:
  - *Listening:* Concentric pulsing purple and lavender rings.
  - *Thinking:* Orbiting gradient spinner and shimmer aura.
  - *Speaking:* Multi-bar bouncing equalizer bars.
  - *Idle / Error:* Soft glowing static microphone and warning badges.
  - *Accessibility:* Full support for `@media (prefers-reduced-motion)`.
- **[`VoiceStatus.tsx`](file:///d:/aura-ai-voice-agent/client/src/components/VoiceStatus.tsx):** Accessible status badge with animated ping dots and clear textual state descriptions.
- **[`VoiceControls.tsx`](file:///d:/aura-ai-voice-agent/client/src/components/VoiceControls.tsx):** Start Call, End Call, real Mute suppression, speech speed toggle, and Error Reset controls.
- **[`VoiceTranscript.tsx`](file:///d:/aura-ai-voice-agent/client/src/components/VoiceTranscript.tsx):** Chronological transcript with speaker labels, timestamps, live interim previews, and tool execution badges (`⚡ Tool: get_order_details`).

---

## 6. How Multi-Turn Voice Context Works

Because the voice engine connects directly to the Phase 3 backend session service, conversation memory is maintained across voice turns:

1. **Turn 1 (Spoken by Customer):**
   > *"Where is my order ORD-101?"*
   - Backend calls `get_order_details('ORD-101')`.
   - Aria replies: *"Here are the verified details for order ORD-101: Priya Sharma, Vitamin C Serum, Status: Out for Delivery by BlueDart..."*
   - Browser voice speaks the response.
   - Session context stores: `{ latestOrderId: 'ORD-101' }`.

2. **Turn 2 (Spoken by Customer):**
   > *"Can I cancel it?"*
   - Customer did not specify an Order ID.
   - Backend retrieves `latestOrderId: 'ORD-101'` from session context.
   - Backend calls `check_cancellation_eligibility('Out for Delivery')`.
   - Aria replies: *"Order ORD-101 is currently Out for Delivery and cannot be cancelled once dispatched. However, you may politely refuse delivery at your doorstep..."*
   - Browser voice speaks the cancellation response.

3. **Turn 3 (Spoken by Customer):**
   > *"What is your shipping policy for Rs 499?"*
   - Backend calls `calculate_shipping_fee(499)`.
   - Tool returns `UNSPECIFIED_POLICY_BOUNDARY`.
   - Aria explains that > ₹499 is free and < ₹499 is ₹50, and explicitly flags ₹499 as an unspecified policy boundary.

---

## 7. Handled Error Conditions & Defenses

1. **Microphone Permission Denied:** Displays actionable guidance prompting the customer to click the camera/mic icon in the browser address bar.
2. **Unsupported Browsers (e.g. Firefox/Safari Desktop for SpeechRecognition):** Displays a clear compatibility notice recommending Chrome or Edge, with a 1-click fallback button to Text Chat mode.
3. **Hardware Device Missing:** Detects `audio-capture` error and alerts the user to check their microphone hardware.
4. **No Speech Detected:** Transient pauses (`no-speech` events) are handled silently without terminating the call or throwing confusing errors.
5. **Rapid Multiple Start Clicks:** State checks (`canStartCall`) prevent redundant session creation or concurrent recognition engines.
6. **End Call During Thinking:** Generation token invalidation ensures that late HTTP responses are dropped; speech playback is never triggered after a call has ended.
7. **End Call During Speaking:** `speechSynthesis.cancel()` halts audio immediately; state machine halts without resuming listening.
8. **Mute Suppression:** When muted, captured speech is ignored and never sent to the backend.
9. **Echo Feedback:** Microphone recognition is paused while Aria is speaking, preventing the assistant from listening to its own voice.
10. **Component Unmount:** React cleanup hooks abort recognition, cancel ongoing speech, and abort pending fetch calls.

---

## 8. Verification & Test Results

### Automated Tests
Run via `npm test` in `client/` and `server/`:
- **Client Tests (`client/tests/voice.test.ts`):** **14 / 14 passing**
  - Markdown text sanitization for speech synthesis.
  - Complete turn state machine transitions (`IDLE` → `INITIALIZING` → `LISTENING` → `THINKING` → `SPEAKING` → `LISTENING`).
  - Rapid click session prevention.
  - End Call interruption during Thinking and Speaking.
  - Indian English (`en-IN`) voice priority and English fallback.
  - Permission denial and unsupported browser error mapping.
- **Backend Tests (`server/tests/**/*.test.ts`):** **79 / 79 passing**
  - Preserves all Phase 1 health check, Phase 2 mock orders/policy guardrails, and Phase 3 conversation engine/session tests.
- **Total Automated Tests:** **93 / 93 passing** across the project.

### Production Builds
- `cd server && npm run build` → Passed with 0 errors.
- `cd client && npm run build` → Passed (`tsc -b && vite build`) with 0 errors.

---

## 9. How to Run Locally

### Terminal 1: Backend
```bash
cd server
npm run dev
```
> Server running at `http://localhost:5000` (defaults to `AI_PROVIDER=demo`)

### Terminal 2: Frontend
```bash
cd client
npm run dev
```
> Frontend running at `http://localhost:5173`

### Run Tests
```bash
# Run backend tests
cd server && npm test

# Run frontend voice tests
cd client && npm test
```

---

## 10. Manual Testing Checklist (In Browser)

To test live voice in Google Chrome or Microsoft Edge:
1. Navigate to `http://localhost:5173`.
2. Ensure the top mode switcher is set to **🎙️ Voice Call**.
3. Click **Start Voice Call**.
4. Allow browser microphone access when prompted.
5. Confirm the visualizer rings pulse in purple and the status indicates **"Aria is listening…"**.
6. Speak: *"Where is my order ORD-101?"*
7. Observe your interim words appear in real-time, then commit as customer dialogue.
8. Observe Aria transition to **Thinking**, followed by **Speaking** with equalizer bars.
9. Listen to Aria's spoken response detailing Priya Sharma's Vitamin C Serum.
10. When Aria finishes speaking, observe the visualizer return automatically to **Listening**.
11. Speak: *"Can I cancel it?"*
12. Listen to Aria confirm that `ORD-101` cannot be cancelled because it is Out for Delivery.
13. Click **End Call** to conclude the session.
14. Verify that the transcript remains visible and microphone recording has stopped.

---

## 11. What Remains for Phase 5

With Phase 4 complete, the voice interface is fully functional. The remaining scope for Phase 5 includes:
- **Post-Call Structured AI Summaries:** Generating structured resolution records (order status, customer intent, policy outcome, action items).
- **Post-Call CRM Export / Ticket Generation:** Mock integration with CRM systems or ticketing webhooks.
- **Audio Quality Metrics:** Call duration tracking, turn count analytics, and latency measurement.
