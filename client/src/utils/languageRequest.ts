import type { SpeechLanguage } from './speech';

/** Detect an explicit language request, not a language mentioned in a product/query. */
export function detectLanguageRequest(text: string): SpeechLanguage | undefined {
  let requested: SpeechLanguage | undefined;
  const clauses = text.toLowerCase().split(/[.!?;,\n]|\b(?:but|and then)\b/);
  for (const clause of clauses) {
    if (/\b(?:don't|dont|do not|never|not|no|translate|if|meaning)\b|नहीं|मत/.test(clause) || /what.*mean|how.*say/.test(clause)) continue;
    const hindi = /\b(?:hindi|hidin)\b|हिन्दी|हिंदी/.test(clause);
    const english = /\benglish\b|अंग्रेज़ी|अंग्रेजी|इंग्लिश/.test(clause);
    if (hindi === english) continue; // No target or an ambiguous "Hindi or English" request.
    const direct = /\b(?:speak|talk|respond|reply|answer|switch|continue|use|bolo|boliye|bol|baat|karo)\b|बोल|बात|कीजिए|जवाब|उत्तर|स्पीक|टॉक|स्विच/.test(clause);
    const short = /^(?:please\s+)?(?:in\s+)?(?:hindi|hidin|english|हिन्दी|हिंदी|अंग्रेज़ी|अंग्रेजी|इंग्लिश)(?:\s+(?:please|में|mein|me|प्लीज|कृपया))*\s*$/.test(clause.trim());
    if (direct || short) requested = hindi ? 'hi' : 'en';
  }
  return requested;
}
