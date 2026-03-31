import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addValidWord,
  isWordValid,
  loadValidWords,
  resetCache,
} from "../../src/services/validWords";

beforeEach(() => {
  resetCache();
  vi.restoreAllMocks();
});

describe("loadValidWords", () => {
  it("loads words from API", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ words: ["Noota", "Slack"] }),
    } as Response);

    const words = await loadValidWords();
    expect(words.has("Noota")).toBe(true);
    expect(words.has("Slack")).toBe(true);
  });

  it("returns empty set on fetch failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));
    const words = await loadValidWords();
    expect(words.size).toBe(0);
  });
});

describe("addValidWord", () => {
  it("sends POST to API", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ words: ["Noota"] }),
    } as Response);

    await addValidWord("Noota");
    expect(fetchMock).toHaveBeenCalledWith(
      "/corrector/api/valid-words",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("isWordValid", () => {
  it("returns true for loaded words", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ words: ["Noota"] }),
    } as Response);

    await loadValidWords();
    expect(isWordValid("Noota")).toBe(true);
    expect(isWordValid("Unknown")).toBe(false);
  });
});
