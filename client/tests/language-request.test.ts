import { it } from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguageRequest } from '../src/utils/languageRequest';

it('recognizes explicit English, Hindi and Hinglish language requests', () => {
  for (const phrase of ['Can you talk in Hindi?', 'Please speak in hidin', 'Hindi please', 'hindi mein baat karo', 'क्या आप हिंदी में बात कर सकते हैं?', 'हिन्दी में बोलिए']) assert.equal(detectLanguageRequest(phrase), 'hi', phrase);
  for (const phrase of ['Speak in English', 'Can you switch to English?', 'English please', 'अंग्रेजी में बात करो', 'कैन यू स्पीक इन इंग्लिश', "I don't understand Hindi, speak English"]) assert.equal(detectLanguageRequest(phrase), 'en', phrase);
});
it('does not switch for a mention, negation, hypothetical or ambiguous language request', () => {
  for (const phrase of ['Does the product have a Hindi label?', 'What does speak Hindi mean?', "Don't speak in Hindi", 'Can you speak Hindi or English?', 'If I say speak Hindi', 'Where is my order?', 'हिंदी में मत बोलो']) assert.equal(detectLanguageRequest(phrase), undefined, phrase);
});
