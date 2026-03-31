import nlp from "compromise";
import type { SuspectWord } from "../types";

/**
 * Detects ALL words in text that might be proper nouns (entities).
 * Does NOT filter by validWords — detection is used to PROTECT words from LT,
 * so even validated words must be detected to prevent LT from correcting them.
 *
 * Uses compromise.js NLP for people, places, organizations detection,
 * plus a heuristic for capitalized words appearing mid-sentence.
 */
export function detectEntities(text: string): string[] {
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
      !seen.has(word.toLowerCase())
    ) {
      seen.add(word.toLowerCase());
      entities.push(word);
    }
  }

  console.log(`[detectEntities] Found ${entities.length} entities:`, entities);
  return entities;
}

/**
 * Finds entity positions in the corrected output text.
 * Only marks entities that are NOT in validWords (already validated by user).
 */
export function markEntitiesInOutput(
  outputText: string,
  entities: string[],
  validWords: Set<string> = new Set(),
): SuspectWord[] {
  const suspects: SuspectWord[] = [];

  for (const entity of entities) {
    // Skip words the user has already validated
    if (validWords.has(entity)) continue;

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

/**
 * Finds the offsets of entity words in the original text.
 * Used to filter LanguageTool matches that would correct entity words.
 */
export function getEntityOffsets(
  text: string,
  entities: string[],
): Array<{ start: number; end: number }> {
  const offsets: Array<{ start: number; end: number }> = [];

  for (const entity of entities) {
    const index = text.toLowerCase().indexOf(entity.toLowerCase());
    if (index >= 0) {
      offsets.push({ start: index, end: index + entity.length });
    }
  }

  return offsets;
}
