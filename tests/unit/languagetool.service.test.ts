import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkLanguageTool, checkLTAvailable } from "../../src/services/languagetool";
import type { LTMatch, LTResponse } from "../../src/types";

describe("checkLanguageTool", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("applyAutoFix behavior", () => {
    it("applyAutoFix_empty - Aucun match → retourne texte original", async () => {
      const mockResponse: LTResponse = { matches: [] };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }) as typeof fetch;

      const result = await checkLanguageTool("Bonjour tout le monde");

      expect(result.correctedText).toBe("Bonjour tout le monde");
      expect(result.matchCount).toBe(0);
    });

    it("applyAutoFix_single - Un match → applique première replacement", async () => {
      const mockMatch: LTMatch = {
        message: "Erreur",
        shortMessage: "Erreur",
        offset: 13,
        length: 2,
        replacements: ["X"],
        rule: { id: "MATCH" },
      };
      const mockResponse: LTResponse = { matches: [mockMatch] };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }) as typeof fetch;

      const result = await checkLanguageTool("Bonjour tout le monde");

      expect(result.correctedText).toBe("Bonjour tout X monde");
      expect(result.matchCount).toBe(1);
    });

    it("applyAutoFix_multiple - Multiples matches → applique en ordre décroissant doffset", async () => {
      const mockMatches: LTMatch[] = [
        {
          message: "Erreur1",
          shortMessage: "Erreur1",
          offset: 13,
          length: 6,
          replacements: ["univers"],
          rule: { id: "RULE1" },
        },
        {
          message: "Erreur2",
          shortMessage: "Erreur2",
          offset: 6,
          length: 5,
          replacements: ["X"],
          rule: { id: "RULE2" },
        },
      ];
      const mockResponse: LTResponse = { matches: mockMatches };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }) as typeof fetch;

      const result = await checkLanguageTool("Hello petit monde");

      expect(result.correctedText).toBe("Hello X munivers");
      expect(result.matchCount).toBe(2);
    });

    it("applyAutoFix_noReplacement - Match sans replacement → ignoré", async () => {
      const mockMatch: LTMatch = {
        message: "Erreur",
        shortMessage: "Erreur",
        offset: 8,
        length: 4,
        replacements: [],
        rule: { id: "MATCH" },
      };
      const mockResponse: LTResponse = { matches: [mockMatch] };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }) as typeof fetch;

      const result = await checkLanguageTool("Bonjour tout le monde");

      expect(result.correctedText).toBe("Bonjour tout le monde");
      expect(result.matchCount).toBe(1);
    });

    it("applyAutoFix_entityWord - LT corrige un mot entité (pas de protection)", async () => {
      // With the new approach, LT sees the entity word directly
      // and might try to correct it. The user decides via SuspectBadge.
      const mockMatch: LTMatch = {
        message: "Faute de frappe",
        shortMessage: "Faute",
        offset: 20,
        length: 5,
        replacements: ["N'opta"],
        rule: { id: "FR_SPELLING" },
      };
      const mockResponse: LTResponse = { matches: [mockMatch] };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }) as typeof fetch;

      const result = await checkLanguageTool("Bonjour, tu connais Noota ?");

      // LT corrects Noota → N'opta (the acronym dict doesn't protect it)
      // But markEntitiesInOutput will still find "Noota" if the LLM restores it
      expect(result.correctedText).toBe("Bonjour, tu connais N'opta ?");
    });
  });

  describe("checkLanguageTool validation", () => {
    it('checkLanguageTool_empty - Texte vide → Error "Le texte ne peut pas être vide"', async () => {
      await expect(checkLanguageTool("")).rejects.toThrow("Le texte ne peut pas être vide");
    });

    it("checkLanguageTool_success - Retourne correctedText et matchCount", async () => {
      const mockResponse: LTResponse = { matches: [] };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }) as typeof fetch;

      const result = await checkLanguageTool("Texte valide");

      expect(result).toHaveProperty("correctedText");
      expect(result).toHaveProperty("matchCount");
      expect(result).toHaveProperty("matches");
      expect(result.correctedText).toBe("Texte valide");
      expect(result.matchCount).toBe(0);
    });

    it("checkLanguageTool_apiError - API error → Error avec message", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as typeof fetch;

      await expect(checkLanguageTool("Texte")).rejects.toThrow("LanguageTool API error: 500");
    });

    it("checkLanguageTool_timeout - Timeout > 5s → AbortError", async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(
          new DOMException("The operation was aborted", "AbortError"),
        ) as typeof fetch;

      await expect(checkLanguageTool("Texte")).rejects.toThrow();
    });
  });
});

describe("checkLTAvailable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("checkLTAvailable_success - Serveur dispo → true", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
    }) as typeof fetch;

    const result = await checkLTAvailable();

    expect(result).toBe(true);
  });

  it("checkLTAvailable_timeout - Timeout 2s → false", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(
        new DOMException("The operation was aborted", "AbortError"),
      ) as typeof fetch;

    const result = await checkLTAvailable();

    expect(result).toBe(false);
  });
});
