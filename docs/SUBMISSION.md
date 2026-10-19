# Submission preparation

This is a preparation document. No links or personal identity are fabricated, and no message has been sent to assessment recipients.

## Approach note (ready to use)

I built Aria as a modular browser voice pipeline using speech recognition, Gemini reasoning with server-side order and policy tools, and browser speech synthesis. The agent looks up the supplied Aura Skincare sample orders, applies policy checks, and generates a chronological transcript with a validated JSON outcome after the call. Explicit voice states, live model fallback and summary retry handle failures without inventing order data or claiming actions were completed.

## 3-5 minute recording outline

| Time | Show and explain |
| --- | --- |
| 0:00-0:25 | Introduce Aria and Aura Skincare; point out the assessment order cards and live AI/sample-data distinction. |
| 0:25-1:15 | Allow microphone access, Start Call, ask where ORD-101 is, hear the answer, then ask "Can I cancel it?" to demonstrate context and the refusal rule. |
| 1:15-2:00 | Ask about returning an opened product after 20 days. Demonstrate a missing/unknown ID or out-of-scope question briefly. |
| 2:00-2:35 | Ask about cancelling ORD-103, showing eligibility without claiming a cancellation was executed. |
| 2:35-3:15 | End Call. Show the chronological transcript, formatted JSON intent/order/resolution/summary and downloaded output. |
| 3:15-4:15 | Walk through the architecture diagram, Gemini tool selection, order data module, deterministic policy tools and voice lifecycle guards. |
| 4:15-4:45 | Explain one tradeoff (browser speech / turn-based latency) and the first improvement with another week. |

Use real microphone input and audible spoken responses. Do not substitute a recording of text-only API checks for the required voice demonstration. Use only the fictional sample orders and hide private environment files/provider credentials in the recording.

## Links and identity still needed

- Public application URL: pending deployment and HTTPS microphone check.
- GitHub repository: https://github.com/bharatsirmal008/DATASTRAW-ASSESSMENT
- Demo video URL: pending actual recording and upload.
- LinkedIn profile: owner to provide the working public link.
- Full name: owner to provide for the final submission subject/signature.

## Final submission checklist

Confirm the public app opens without local setup, Start/End and audio work, sample-order helper is visible, and transcript/JSON appear after a call. Open each repository/video/profile link in a signed-out browser to verify access. Keep the API key only in the host's server-side secret settings and verify `.env` is absent from the published source. Include the Section 9 README answers and the approach note above.

The PDF's submission section supplies recipients and subject format. Sending that email requires the owner's explicit instruction; this document does not send anything.
