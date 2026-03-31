let validWordsCache: Set<string> | null = null;

export function resetCache(): void {
  validWordsCache = null;
}

export async function loadValidWords(): Promise<Set<string>> {
  if (validWordsCache) {
    return validWordsCache;
  }

  try {
    const response = await fetch("/corrector/api/valid-words");
    if (!response.ok) {
      console.warn("Could not load valid words, using empty set");
      validWordsCache = new Set();
      return validWordsCache;
    }

    const data = await response.json();
    validWordsCache = new Set(data.words || []);
    return validWordsCache;
  } catch (e) {
    console.warn("Failed to load valid words:", e);
    validWordsCache = new Set();
    return validWordsCache;
  }
}

export async function addValidWord(word: string): Promise<void> {
  try {
    const response = await fetch("/corrector/api/valid-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });

    if (response.ok) {
      const data = await response.json();
      validWordsCache = new Set(data.words || []);
    }
  } catch (e) {
    console.warn("Failed to add valid word:", e);
  }
}

export function isWordValid(word: string): boolean {
  return validWordsCache?.has(word) ?? false;
}
