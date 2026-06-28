import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyLTCorrections,
  checkLTAvailable,
  runLanguageTool,
} from "../../src/services/languagetool";
import type { LTMatch, LTResponse } from "../../src/types";

describe("runLanguageTool", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("texte vide → throw", async () => {
    await expect(runLanguageTool("   ")).rejects.toThrow("Le texte ne peut pas être vide");
  });

  it("retourne les matches de l'API", async () => {
    const mockResponse: LTResponse = { matches: [] };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch;

    const result = await runLanguageTool("Bonjour monde");
    expect(result).toEqual([]);
  });

  it("API error → throw", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    await expect(runLanguageTool("Texte")).rejects.toThrow("LanguageTool API error: 500");
  });
});

describe("applyLTCorrections", () => {
  it("aucun match → texte inchangé, corrections vides", () => {
    const result = applyLTCorrections("Bonjour monde", []);
    expect(result.correctedText).toBe("Bonjour monde");
    expect(result.corrections).toHaveLength(0);
  });

  it("un match → applique le premier replacement", () => {
    const match: LTMatch = {
      message: "Erreur",
      shortMessage: "Erreur",
      offset: 8,
      length: 5,
      replacements: ["monde"],
      rule: { id: "SPELL" },
    };
    const result = applyLTCorrections("Bonjour moond", [match]);
    expect(result.correctedText).toBe("Bonjour monde");
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0]).toEqual({ avant: "moond", apres: "monde", regle: "SPELL" });
  });

  it("multiples matches → applique en ordre, résultat en ordre de lecture", () => {
    const matches: LTMatch[] = [
      {
        message: "",
        shortMessage: "",
        offset: 0,
        length: 5,
        replacements: ["Salut"],
        rule: { id: "R1" },
      },
      {
        message: "",
        shortMessage: "",
        offset: 6,
        length: 5,
        replacements: ["monde"],
        rule: { id: "R2" },
      },
    ];
    const result = applyLTCorrections("Bonur moond", matches);
    expect(result.correctedText).toBe("Salut monde");
    expect(result.corrections[0].avant).toBe("Bonur");
    expect(result.corrections[1].avant).toBe("moond");
  });

  it("match sans replacement → ignoré", () => {
    const match: LTMatch = {
      message: "",
      shortMessage: "",
      offset: 0,
      length: 3,
      replacements: [],
      rule: { id: "R" },
    };
    const result = applyLTCorrections("Bon texte", [match]);
    expect(result.correctedText).toBe("Bon texte");
    expect(result.corrections).toHaveLength(0);
  });
});

describe("checkLTAvailable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("serveur disponible → true", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    expect(await checkLTAvailable()).toBe(true);
  });

  it("timeout → false", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException("aborted", "AbortError")) as unknown as typeof fetch;
    expect(await checkLTAvailable()).toBe(false);
  });
});
