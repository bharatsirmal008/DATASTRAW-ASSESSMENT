# English voice and conversation fixes

19 October 2026. These changes address English number pronunciation, voice mismatch, lost speech fragments and excessive repetition.

- In default English mode select only voices whose language is English (`en-*`), with `en-IN` preferred. A Hindi voice with "India" in its name is never treated as Indian English. Explicitly set each utterance's language. If no English voice exists, show an error and retain text support instead of using the OS's non-English default.
- Add an English voice selector and a local pronunciation preview under "Voice & pronunciation settings". The preview uses no model requests.
- Prepare a separate speech string: INR/rupee amounts become English words, order/tracking digits are read individually, ranges/times/units/acronyms are expanded, and Devanagari digits are converted before speaking. The transcript and JSON keep the original source text and values.
- Batch final speech-recognition fragments across a 350ms pause. Repeated final-result events are ignored within the same recognition cycle; intentional repeated statements in later turns are still accepted. Ending a call cancels pending fragments. Cache a successful microphone permission check rather than acquiring media again after every answer.
- Cancel speech promises even when the browser does not emit cancellation events. Ignore stale callbacks and late replies after ending.
- Ask the live model for short, plain-English answers without repeated greetings, generic follow-up offers or unnecessary tracking-code narration. Keep the verified order in context, and clear it if a subsequent new order cannot be found. Spoken "order one hundred and one" resolves to ORD-101.
- Return computed cancellation eligibility with an order lookup to avoid an extra model/tool round-trip. Use low thinking for the configured 3.8 Flash fallback; the 3.5 Flash-Lite primary retains its default minimal thinking. A shared 22-second signal bounds model requests across the turn rather than letting every fallback/tool round start a new full timeout.

## Validation and limits

Unit and mounted-hook tests cover Hindi-first voice lists, unavailable English voices, English utterance language/text, amounts and decimals, order IDs, split speech, duplicate events, cancelling pending speech, microphone reuse, and browsers that omit cancellation events. Existing policy, context and call lifecycle tests also pass.

`output/assessment/voice-verification.json` contains a real four-turn Gemini check exercised through the voice UI with substituted microphone and OS speech APIs. The real backend retrieved ORD-101, maintained it for "can I cancel it?", explained the COD limit and switched to ORD-103. All speech payloads were English words with `en-IN`. Measured recognition-event-to-speech-payload times were 3.252, 2.922, 1.679 and 2.620 seconds in this local check. These are not full hardware microphone-to-speaker measurements or a latency guarantee. The live summary also passed.

Physical sound quality and recognition accuracy still depend on the installed English voice, microphone, browser and network. Use the new pronunciation preview, then speak a real multi-turn call to check the actual device audio. Native streaming audio and barge-in are not implemented.

References: [utterance language](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/lang), [voice language](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/lang), [Gemini thinking levels](https://ai.google.dev/gemini-api/docs/thinking).

## Optional Hindi mode

A Conversation language selector now offers English (default) or Hindi before starting a call. Recognition, trusted model response language, voice filtering and pronunciation preparation switch together. Hindi voice selection accepts only hi-* voices; a missing Hindi voice produces an explicit text fallback notice. English retains its previous locale and English number expansion. Model language is validated as en or hi before it is recorded in session context. The language control is locked while a call is active. Hindi order identifiers in common digit-by-digit or hundred forms normalize to the same order IDs; original transcript text is preserved. Summaries remain in English.

197 tests pass (165 backend, 32 frontend); both builds pass. Live evidence in output/assessment/hindi-verification.json verifies two real Gemini Hindi replies, ORD-101 follow-up context, hi-IN speech payloads and a generated summary through the actual voice UI. Microphone and OS voice APIs were mocked for inspection; actual audible Hindi voice quality still requires a device check.

## Spoken language switching

During a call, explicit requests such as "Can you talk in Hindi?", "Speak in English", "Hindi mein baat karo" and Hindi-script equivalents switch the language on the same session. Speech recognition restarts in the target locale after the reply, and speech synthesis uses the target voice for that very reply, avoiding stale-language closure races. The dropdown still locks during active calls; the conversation request is the supported switching path. Negations, unrelated mentions and ambiguous "Hindi or English" questions do not automatically choose a language. The same request detector also applies to text chat API calls from the client.

200 tests pass (165 backend and 35 frontend). Live evidence in output/assessment/language-switch-verification.json covers English order lookup, a Hindi switch, a Hindi cancellation follow-up and an English switch. The same ORD-101 context was retained; both recognition and speech payload locales matched the selected language. Browser audio APIs were mocked and Gemini replies were live, so a real device listening check is still separate.
