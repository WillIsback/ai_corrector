import nlp from "compromise";
import type { SuspectWord } from "../types";

/**
 * Detects words in text that might be proper nouns (entities).
 *
 * Uses compromise.js NLP for people, places, organizations detection,
 * plus a heuristic for capitalized words appearing mid-sentence.
 */
export function detectEntities(text: string, validWords: Set<string>): string[] {
  const seen = new Set<string>();
  const entities: string[] = [];

  const doc = nlp(text);

  // Detect people, places, organizations
  const nlpEntities = [
    ...doc.people().out("offset"),
    ...doc.places().out("offset"),
    ...doc.organizations().out("offset"),
  ];

  for (const entity of nlpEntities) {
    const word = entity.text.trim();
    if (seen.has(word.toLowerCase())) continue;
    if (validWords.has(word)) continue;

    seen.add(word.toLowerCase());
    entities.push(word);
  }

  // Heuristic: words with capital letter mid-sentence
  const words = text.split(/(\s+)/);
  let seenNonWhitespace = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (/^\s+$/.test(word)) {
      continue;
    }

    const isSentenceStart = !seenNonWhitespace || (i > 0 && /[.!?]\s*$/.test(words[i - 1]));
    seenNonWhitespace = true;

    if (
      word.length > 1 &&
      /^[A-ZÀ-Ý]/.test(word) &&
      !isSentenceStart &&
      !seen.has(word.toLowerCase()) &&
      !validWords.has(word)
    ) {
      seen.add(word.toLowerCase());
      entities.push(word);
    }
  }

  return entities;
}

/**
 * Finds entity positions in the corrected output text.
 * For each detected entity from the input, searches for it in the output
 * and returns SuspectWord entries with correct offsets.
 */
export function markEntitiesInOutput(outputText: string, entities: string[]): SuspectWord[] {
  const suspects: SuspectWord[] = [];

  for (const entity of entities) {
    const index = outputText.toLowerCase().indexOf(entity.toLowerCase());
    if (index >= 0) {
      suspects.push({
        originalText: outputText.slice(index, index + entity.length),
        offset: index,
        length: entity.length,
      });
    }
  }

  return suspects;
}
