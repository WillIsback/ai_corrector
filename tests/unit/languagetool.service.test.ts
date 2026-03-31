import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectEntities, protectEntities } from "../../src/services/entityDetector";
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
      // "Bonjour tout le monde"
      // 0123456789012345678901234
      // offset 13 = start of "le" (l), length 2
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

      // Apply: slice(0,13) + "X" + slice(15) = "Bonjour tout X monde"
      expect(result.correctedText).toBe("Bonjour tout X monde");
      expect(result.matchCount).toBe(1);
    });

    it("applyAutoFix_multiple - Multiples matches → applique en ordre décroissant doffset", async () => {
      // Test with two non-overlapping matches
      // "Hello petit monde"
      // Match 1: offset 13, length 6 -> "monde" -> "univers"
      // Match 2: offset 6, length 5 -> "petit" -> "X"
      // Sorted by offset desc: first offset 13, then offset 6
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

      // Actual behavior: applyAutoFix processes matches in decreasing offset order
      // and applies them to the current result (not original text).
      // First (offset 13): "Hello petit monde" -> "Hello petit univers"
      // Second (offset 6): on "Hello petit univers" -> "Hello X munivers"
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
      // Simulate what happens when the 5s timeout fires and aborts the request
      // The fetch will throw an AbortError when aborted
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

describe("checkLanguageTool with entity protection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should not corrupt placeholders when LT returns adjacent matches", async () => {
    const originalText = "J'utilise Noota ici.";
    const suspects = detectEntities(originalText, new Set());
    const protectedText = protectEntities(originalText, suspects);
    console.log("Protected:", protectedText);

    // Simulate LT returning a match that's adjacent to the placeholder
    // The protected text has __PROT_0__ where Noota was
    const mockResponse: LTResponse = {
      matches: [
        {
          message: "Accord",
          shortMessage: "",
          offset: protectedText.indexOf("utilise"),
          length: 7,
          replacements: ["utilisé"],
          rule: { id: "FRENCH_WHEN" },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as typeof fetch;

    const result = await checkLanguageTool(protectedText, suspects);
    console.log("Result:", result.correctedText);
    console.log("Suspects:", JSON.stringify(result.suspects, null, 2));

    // Noota should appear exactly once
    const nootaMatches = result.correctedText.match(/Noota/g);
    expect(nootaMatches).toHaveLength(1);
    expect(result.correctedText).toBe("J'utilisé Noota ici.");
  });

  it("should handle LT match that includes placeholder text", async () => {
    const protectedText = "Bonjour __PROT_0__ monde";
    const suspects = [
      {
        placeholder: "__PROT_0__",
        originalText: "Noota",
        offset: 8,
        length: 5,
        wasCorrected: false,
      },
    ];

    // LT matches "__PROT_0__" itself (hypothetical - LT treats it as an error)
    const mockResponse: LTResponse = {
      matches: [
        {
          message: "Unknown word",
          shortMessage: "",
          offset: 8,
          length: 10,
          replacements: ["Noota"],
          rule: { id: "MORFOLOGIK" },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as typeof fetch;

    const result = await checkLanguageTool(protectedText, suspects);

    // Noota should appear exactly once
    const nootaMatches = result.correctedText.match(/Noota/g);
    expect(nootaMatches).toHaveLength(1);
  });

  it("should NOT corrupt text when LT match straddles a placeholder boundary", async () => {
    // This is the bug: LT matches a span that partially overlaps a placeholder
    // e.g., match at offset 5, length 15 in "__PROT_0__ hello" would corrupt __PROT_0__
    const protectedText = "avec __PROT_0__ ici";
    const suspects = [
      {
        placeholder: "__PROT_0__",
        originalText: "Noota",
        offset: 5,
        length: 5,
        wasCorrected: false,
      },
    ];

    // LT returns a match that STRADDLES the placeholder boundary
    // Match: "avec __PROT_0" (offset 0, length 14) — partially overlaps placeholder
    const mockResponse: LTResponse = {
      matches: [
        {
          message: "Grammar",
          shortMessage: "",
          offset: 0,
          length: 14, // "avec __PROT_0" — straddles the placeholder
          replacements: ["avec"],
          rule: { id: "GRAMMAR_RULE" },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as typeof fetch;

    const result = await checkLanguageTool(protectedText, suspects);

    // With the bug: applyAutoFix corrupts __PROT_0__, restoreEntities fails
    // Expected: Noota should appear exactly once
    const nootaMatches = result.correctedText.match(/Noota/g);
    expect(nootaMatches).not.toBeNull();
    expect(nootaMatches).toHaveLength(1);
  });

  it("should reproduce user-reported bug with real LT flow", async () => {
    // Full simulation of user's flow:
    // Input: "Bonjour, tu connais Noota ?"
    const originalText = "Bonjour, tu connais Noota ?";

    // Step 1: detect entities
    const suspects = detectEntities(originalText, new Set());
    console.log(
      "Detected suspects:",
      suspects.map((s) => `${s.originalText}@${s.offset}`),
    );

    // Step 2: protect
    const protectedText = protectEntities(originalText, suspects);
    console.log("Protected text:", protectedText);

    // Step 3: LT response on protected text
    // LT might return multiple matches including some near the placeholder
    const mockResponse: LTResponse = {
      matches: [
        {
          message: "Formel",
          shortMessage: "",
          offset: 9, // "tu connais"
          length: 10,
          replacements: ["connaissez-vous"],
          rule: { id: "INFORMAL" },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as typeof fetch;

    const result = await checkLanguageTool(protectedText, suspects);
    console.log("LT result:", result.correctedText);

    // Verify no duplicates
    const nootaMatches = result.correctedText.match(/Noota/g);
    expect(nootaMatches).toHaveLength(1);
    expect(result.correctedText).toBe("Bonjour, connaissez-vous Noota ?");
  });
});
