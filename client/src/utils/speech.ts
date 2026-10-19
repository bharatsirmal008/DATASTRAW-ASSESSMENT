const small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const digits = (value: string) => value.split('').map(digit => small[Number(digit)]).join(' ');

export function englishNumber(value: string): string {
  const clean = value.replace(/,/g, '');
  const [whole, fraction] = clean.split('.');
  const number = Number(whole);
  const integer = (n: number): string => {
    if (n < 20) return small[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${small[n % 10]}` : ''}`;
    if (n < 1000) return `${small[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${integer(n % 100)}` : ''}`;
    for (const [scale, name] of [[10000000, 'crore'], [100000, 'lakh'], [1000, 'thousand']] as const) {
      if (n >= scale) return `${integer(Math.floor(n / scale))} ${name}${n % scale ? ` ${integer(n % scale)}` : ''}`;
    }
    return '';
  };
  const spoken = !Number.isSafeInteger(number) || whole.length > 12 || /^0\d/.test(whole) ? digits(whole) : integer(number);
  return fraction ? `${spoken} point ${digits(fraction)}` : spoken;
}

/** Spoken text only; the original values stay intact in the transcript. */
export function sanitizeTextForSpeech(raw: string): string {
  if (!raw) return '';
  let text = raw
    .replace(/[\u0966-\u096f]/g, digit => String(digit.charCodeAt(0) - 0x0966))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, '')
    .replace(/^[ \t]*(?:[-*+•]\s+|#{1,6}\s*)/gm, '')
    .replace(/[*_`]/g, '').replace(/•/g, ', ')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '');
  text = text.replace(/(?:₹\s*|\b(?:INR|Rs\.?)\s*)(\d[\d,]*(?:\.\d{1,2})?)/gi, (_match, value: string) => {
    const [rupees, paise] = value.split('.');
    return `${englishNumber(rupees)} ${Number(rupees.replace(/,/g, '')) === 1 ? 'rupee' : 'rupees'}${paise && Number(paise) ? ` and ${englishNumber(String(Number(paise.padEnd(2, '0'))))} paise` : ''}`;
  });
  text = text.replace(/\bORD\s*[-:]?\s*(\d+)\b/gi, (_match, id: string) => `O R D ${digits(id)}`)
    .replace(/\b([a-z]{2,5})-(\d{3,})\b/gi, (_match, prefix: string, id: string) => `${prefix.toUpperCase().split('').join(' ')} ${digits(id)}`)
    .replace(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/gi, (_match, hour: string, minute: string | undefined, period: string) => `${englishNumber(hour)}${minute && minute !== '00' ? ` ${minute.startsWith('0') ? `oh ${englishNumber(minute.slice(1))}` : englishNumber(minute)}` : ''} ${period.toUpperCase().split('').join(' ')}`)
    .replace(/(\d+)\s*[–—-]\s*(\d+)/g, '$1 to $2')
    .replace(/\b(\d+)\s*ml\b/gi, '$1 millilitres')
    .replace(/\b(COD|UPI|SPF)\b/gi, acronym => acronym.toUpperCase().split('').join(' '))
    .replace(/\b\d[\d,]*(?:\.\d+)?\b/g, value => englishNumber(value));
  return text.replace(/\s+/g, ' ').trim();
}

export function isEnglishVoice(voice: Pick<SpeechSynthesisVoice, 'lang'>): boolean {
  return /^en(?:[-_]|$)/i.test(voice.lang);
}

export function selectEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter(isEnglishVoice);
  return english.find(voice => /^en[-_]IN$/i.test(voice.lang))
    || english.find(voice => /^en[-_]GB$/i.test(voice.lang))
    || english.find(voice => /^en[-_]US$/i.test(voice.lang)) || english[0] || null;
}

export type SpeechLanguage = 'en' | 'hi';
export function matchesSpeechLanguage(voice: Pick<SpeechSynthesisVoice, 'lang'>, language: SpeechLanguage): boolean {
  return language === 'en' ? isEnglishVoice(voice) : /^hi(?:[-_]|$)/i.test(voice.lang);
}
export function selectSpeechVoice(voices: SpeechSynthesisVoice[], language: SpeechLanguage): SpeechSynthesisVoice | null {
  return language === 'en' ? selectEnglishVoice(voices) : voices.find(voice => /^hi[-_]IN$/i.test(voice.lang)) || voices.find(voice => matchesSpeechLanguage(voice, 'hi')) || null;
}
export function sanitizeHindiSpeech(raw: string): string {
  const hindiDigits = ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ'];
  return raw.replace(/[\u0966-\u096f]/g, digit => String(digit.charCodeAt(0) - 0x0966))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, '')
    .replace(/^[ \t]*(?:[-*+•]\s+|#{1,6}\s*)/gm, '').replace(/[*_`]/g, '').replace(/•/g, ', ')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\bORD\s*[-:]?\s*(\d+)\b/gi, (_match, id: string) => `ओ आर डी ${id.split('').map(digit => hindiDigits[Number(digit)]).join(' ')}`)
    .replace(/(?:₹\s*|\b(?:INR|Rs\.?)\s*)(\d[\d,]*)(?:\.(\d{1,2}))?/gi, (_match, rupees: string, paise: string) => `${rupees.replace(/,/g, '')} रुपये${paise && Number(paise) ? ` और ${Number(paise.padEnd(2, '0'))} पैसे` : ''}`)
    .replace(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/gi, (_match, hour: string, minute: string, period: string) => `${period.toUpperCase() === 'PM' ? 'शाम' : 'सुबह'} ${hour} बजे${minute && minute !== '00' ? ` ${minute} मिनट` : ''}`)
    .replace(/(\d+)\s*[–—-]\s*(\d+)/g, '$1 से $2')
    .replace(/\bUPI\b/gi, 'यू पी आई').replace(/\bCOD\b/gi, 'सी ओ डी')
    .replace(/\s+/g, ' ').trim();
}
