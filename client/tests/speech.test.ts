import { it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTextForSpeech, selectEnglishVoice, selectSpeechVoice, sanitizeHindiSpeech } from '../src/utils/speech';

it('speaks INR amounts in English including Indian grouping and paise', () => {
  for (const [input, expected] of [
    ['₹699', 'six hundred and ninety nine rupees'],
    ['₹2,500', 'two thousand five hundred rupees'],
    ['INR 1,00,000', 'one lakh rupees'],
    ['Rs. 1,499.50', 'one thousand four hundred and ninety nine rupees and fifty paise'],
    ['₹1', 'one rupee'], ['₹0.05', 'zero rupees and five paise'],
    ['₹६९९', 'six hundred and ninety nine rupees'],
  ]) assert.equal(sanitizeTextForSpeech(input), expected);
});
it('reads order and tracking IDs digit by digit without changing the transcript source', () => {
  const source = '**ORD-101** via BlueDart, BD-982103.';
  assert.equal(sanitizeTextForSpeech(source), 'O R D one zero one via BlueDart, B D nine eight two one zero three.');
  assert.equal(source, '**ORD-101** via BlueDart, BD-982103.');
});
it('reads delivery ranges, clock times, quantities and decimals naturally', () => {
  for (const [input, expected] of [
    ['3–5 business days', 'three to five business days'],
    ['within 48 hours', 'within forty eight hours'],
    ['6:05 PM', 'six oh five P M'], ['6:30 PM', 'six thirty P M'],
    ['SPF 50, 30ml', 'S P F fifty, thirty millilitres'],
    ['COD and UPI', 'C O D and U P I'], ['1.15', 'one point one five'],
  ]) assert.equal(sanitizeTextForSpeech(input), expected);
});
it('selects voices by English locale, never by an India label on a Hindi voice', () => {
  const voices = [{ name: 'Microsoft Heera - India', lang: 'hi-IN' }, { name: 'Microsoft Neerja', lang: 'en-IN' }, { name: 'US', lang: 'en-US' }] as SpeechSynthesisVoice[];
  assert.equal(selectEnglishVoice(voices)?.name, 'Microsoft Neerja');
  assert.equal(selectEnglishVoice([voices[0], voices[2]])?.lang, 'en-US');
  assert.equal(selectEnglishVoice([voices[0]]), null);
  assert.equal(selectEnglishVoice([]), null);
});
it('selects Hindi only when requested and never falls back to another language', () => {
  const voices = [{ name: 'Hindi India', lang: 'hi-IN' }, { name: 'English', lang: 'en-IN' }] as SpeechSynthesisVoice[];
  assert.equal(selectSpeechVoice(voices, 'hi')?.lang, 'hi-IN');
  assert.equal(selectSpeechVoice(voices, 'en')?.lang, 'en-IN');
  assert.equal(selectSpeechVoice([voices[1]], 'hi'), null);
});
it('prepares Hindi currency, order digits and delivery times without English number words', () => {
  assert.equal(sanitizeHindiSpeech('**ORD-१०१** का मूल्य ₹699.50 है। 6 PM तक।'), 'ओ आर डी एक शून्य एक का मूल्य 699 रुपये और 50 पैसे है। शाम 6 बजे तक।');
  assert.equal(sanitizeHindiSpeech('3–5 दिन, COD और UPI'), '3 से 5 दिन, सी ओ डी और यू पी आई');
});
