/** Normalize common browser speech transcripts without guessing arbitrary IDs. */
export function normalizeOrderIds(text: string): string {
  const hindiDigits: Record<string, string> = { शून्य: '0', जीरो: '0', एक: '1', दो: '2', तीन: '3', चार: '4', पाँच: '5', पांच: '5', छह: '6', छः: '6', सात: '7', आठ: '8', नौ: '9' };
  text = text.replace(/[\u0966-\u096f]/g, digit => String(digit.charCodeAt(0) - 0x0966))
    .replace(/(?:ओ\s*आर\s*डी|ऑर्डर(?:\s+(?:नंबर|आईडी))?)\s*[-:]?\s*(?:एक\s+)?सौ(?:\s+(एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ))?/gu,
      (_match, ones: string) => `ORD-${100 + Number(hindiDigits[ones] || 0)}`)
    .replace(/(?:ओ\s*आर\s*डी|ऑर्डर(?:\s+(?:नंबर|आईडी))?)\s*[-:]?\s*((?:(?:शून्य|जीरो|एक|दो|तीन|चार|पाँच|पांच|छह|छः|सात|आठ|नौ|\d)\s*){3,})/gu,
      (_match, value: string) => `ORD-${value.trim().split(/\s+/).map(part => hindiDigits[part] ?? part).join('')}${value.match(/\s*$/)?.[0] || ''}`);
  const digits: Record<string, string> = { zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const normalized = text.replace(/[\u0966-\u096f]/g, digit => String(digit.charCodeAt(0) - 0x0966)).replace(/\b(?:o\s*r\s*d|order(?:\s+(?:number|id))?)\s*[-:]?\s*(one|two|three|four|five|six|seven|eight|nine)\s+hundred(?:\s+and)?(?:\s+(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))?(?:\s+(one|two|three|four|five|six|seven|eight|nine))?\b/gi,
    (_match, hundreds: string, tens: string, ones: string) => `ORD-${words[hundreds.toLowerCase()] * 100 + (words[tens?.toLowerCase()] || 0) + (words[ones?.toLowerCase()] || 0)}`);
  return normalized.replace(/\b(?:o\s*r\s*d|order(?:\s+(?:number|id))?)\s*[-:]?\s*((?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|\d)\s*){3,})\b/gi,
    (_match, value: string) => `ORD-${value.trim().split(/\s+/).map(part => digits[part.toLowerCase()] ?? part).join('')}${value.match(/\s*$/)?.[0] || ''}`);
}

export type SupportIntent = 'tracking' | 'cancellation' | 'returns' | 'damage' | 'shipping' | 'cod' | 'brand';

export function detectIntent(text: string): SupportIntent | undefined {
  if (/\b(damag\w*|broken|defect\w*|leak\w*|replacement)\b/i.test(text)) return 'damage';
  if (/\b(cancel\w*|stop (?:my |the )?order)\b/i.test(text)) return 'cancellation';
  if (/\b(return\w*|refund\w*|exchange|money back)\b/i.test(text)) return 'returns';
  if (/\b(cod|cash|upi|pay(?:ment)? (?:on|at) delivery)\b/i.test(text)) return 'cod';
  if (/\b(shipping|delivery (?:fee|charge|cost|time)|free delivery|how long|business days)\b/i.test(text)) return 'shipping';
  if (/\b(track\w*|where|status|parcel|package|arriv\w*|courier|dispatch\w*|when.*(?:deliver|come)|hasn.t (?:come|arrived)|not (?:received|arrived))\b/i.test(text)) return 'tracking';
  if (/\b(brand|aura|organic|ingredient\w*|product\w*|serum|sunscreen|toner|face wash|skin\w*)\b/i.test(text)) return 'brand';
  return undefined;
}

export function extractAmount(text: string): number | undefined {
  // Order numbers are identifiers, never order values.
  const clean = normalizeOrderIds(text).replace(/\bORD-\d+\b/gi, '');
  const amount = clean.match(/(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d{1,2})?)(?:\s*(?:rupees|rs|inr))?/i);
  return amount ? Number(amount[1].replace(/,/g, '')) : undefined;
}
