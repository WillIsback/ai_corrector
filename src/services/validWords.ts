let validWordsCache: Set<string> | null = null;

export function resetCache(): void {
  validWordsCache = null;
}

export async function loadValidWords(): Promise<Set<string>> {
  if (validWordsCache) {
    console.log(`[validWords] Using cached ${validWordsCache.size} words`);
    return validWordsCache;
  }

  try {
    const response = await fetch("/corrector/api/valid-words");
    if (!response.ok) {
      console.warn("[validWords] Could not load valid words, using empty set");
      validWordsCache = new Set();
      return validWordsCache;
    }

    const data = await response.json();
    validWordsCache = new Set(data.words || []);
    console.log(`[validWords] Loaded ${validWordsCache.size} words from API:`, [
      ...validWordsCache,
    ]);
    return validWordsCache;
  } catch (e) {
    console.warn("[validWords] Failed to load valid words:", e);
    validWordsCache = new Set();
    return validWordsCache;
  }
}

export async function addValidWord(word: string): Promise<boolean> {
  try {
    const url = "/corrector/api/valid-words";
    const body = JSON.stringify({ word });
    console.log(`[validWords] POST ${url} body=${body}`);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const ct = response.headers.get("content-type") || "";
    console.log(`[validWords] Response: status=${response.status} ok=${response.ok} ct=${ct}`);

    if (!response.ok) {
      console.warn(`[validWords] POST failed with status ${response.status}`);
      return false;
    }

    // Check if response is actually JSON (not HTML from SPA fallback)
    if (!ct.includes("json")) {
      const text = await response.text();
      console.error(`[validWords] Expected JSON but got: ${text.slice(0, 100)}`);
      return false;
    }

    const data = await response.json();
    validWordsCache = new Set(data.words || []);
    console.log(`[validWords] Added "${word}". Cache: ${[...validWordsCache].join(", ")}`);
    return true;
  } catch (e) {
    console.warn("[validWords] Failed to add valid word:", e);
    return false;
  }
}

export function isWordValid(word: string): boolean {
  return validWordsCache?.has(word) ?? false;
}
