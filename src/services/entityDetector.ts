import nlp from "compromise";
import type { SuspectWord } from "../types";

/**
 * Detects words in text that might be proper nouns (entities) and should be
 * protected from LanguageTool corrections.
 *
 * Uses compromise.js NLP for people, places, organizations detection,
 * plus a heuristic for capitalized words appearing mid-sentence.
 */
export function detectEntities(text: string, validWords: Set<string>): SuspectWord[] {
  const suspects: SuspectWord[] = [];
  const seen = new Set<string>();

  const doc = nlp(text);

  // Detect people, places, organizations
  const entities = [
    ...doc.people().out("offset"),
    ...doc.places().out("offset"),
    ...doc.organizations().out("offset"),
  ];

  for (const entity of entities) {
    const word = entity.text.trim();
    if (seen.has(word.toLowerCase())) continue;
    if (validWords.has(word)) continue;

    seen.add(word.toLowerCase());
    suspects.push({
      placeholder: `__PROT_${suspects.length}__`,
      originalText: word,
      offset: entity.offset.start,
      length: word.length,
      wasCorrected: false,
    });
  }

  // Heuristic: words with capital letter mid-sentence
  const words = text.split(/(\s+)/);
  let currentOffset = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isFirstWord = i === 0 || (i > 0 && words.slice(0, i).every((w) => /^\s+$/.test(w)));
    const prevEndsWithPeriod = i > 0 && /[.!?]\s*$/.test(words[i - 1]);

    if (
      word.length > 1 &&
      /^[A-ZÀ-Ý]/.test(word) &&
      !isFirstWord &&
      !prevEndsWithPeriod &&
      !seen.has(word.toLowerCase()) &&
      !validWords.has(word) &&
      !/^\s+$/.test(word)
    ) {
      seen.add(word.toLowerCase());
      suspects.push({
        placeholder: `__PROT_${suspects.length}__`,
        originalText: word,
        offset: currentOffset,
        length: word.length,
        wasCorrected: false,
      });
    }

    currentOffset += word.length;
  }

  return suspects;
}

/**
 * Replaces detected entities with placeholder tokens so LanguageTool
 * doesn't try to correct them.
 */
export function protectEntities(text: string, suspects: SuspectWord[]): string {
  // Sort in reverse offset order to avoid offset shifts during replacement
  const sorted = [...suspects].sort((a, b) => b.offset - a.offset);
  let result = text;

  for (const suspect of sorted) {
    result =
      result.slice(0, suspect.offset) +
      suspect.placeholder +
      result.slice(suspect.offset + suspect.length);
  }

  return result;
}

/**
 * Restores original entities from placeholders after LanguageTool processing.
 * If a placeholder is missing from the LT output, marks it as corrected.
 */
export function restoreEntities(
  ltText: string,
  suspects: SuspectWord[],
): { text: string; suspects: SuspectWord[] } {
  let result = ltText;
  const updatedSuspects: SuspectWord[] = [];

  for (const suspect of suspects) {
    const placeholderIndex = result.indexOf(suspect.placeholder);

    if (placeholderIndex === -1) {
      console.warn(`Placeholder ${suspect.placeholder} not found in LT output`);
      updatedSuspects.push({ ...suspect, wasCorrected: true });
      continue;
    }

    result =
      result.slice(0, placeholderIndex) +
      suspect.originalText +
      result.slice(placeholderIndex + suspect.placeholder.length);

    updatedSuspects.push({
      ...suspect,
      offset: placeholderIndex,
      length: suspect.originalText.length,
      wasCorrected: false,
    });
  }

  return { text: result, suspects: updatedSuspects };
}
