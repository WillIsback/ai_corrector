import { describe, expect, it } from "vitest";
import {
  detectEntities,
  protectEntities,
  restoreEntities,
} from "../../src/services/entityDetector";
import type { SuspectWord } from "../../src/types";

describe("detectEntities", () => {
  it("detects proper nouns as suspects", () => {
    const text = "L'application Noota est française";
    const suspects = detectEntities(text, new Set());
    expect(suspects.length).toBeGreaterThan(0);
    const nootaSuspect = suspects.find((s) => s.originalText === "Noota");
    expect(nootaSuspect).toBeDefined();
    expect(nootaSuspect?.originalText).toBe("Noota");
  });

  it("excludes words from validWords set", () => {
    const text = "Noota est super";
    const validWords = new Set(["Noota"]);
    const suspects = detectEntities(text, validWords);
    expect(suspects).toHaveLength(0);
  });

  it("excludes words at start of sentence", () => {
    const text = "Application est importante.";
    const suspects = detectEntities(text, new Set());
    const hasApplication = suspects.some((s) => s.originalText === "Application");
    expect(hasApplication).toBe(false);
  });
});

describe("protectEntities", () => {
  it("replaces entities with placeholders", () => {
    const text = "Noota est super";
    const suspects: SuspectWord[] = [
      {
        placeholder: "__PROT_0__",
        originalText: "Noota",
        offset: 0,
        length: 5,
        wasCorrected: false,
      },
    ];
    const result = protectEntities(text, suspects);
    expect(result).toBe("__PROT_0__ est super");
  });
});

describe("restoreEntities", () => {
  it("restores original text from placeholders", () => {
    const ltText = "__PROT_0__ est super";
    const suspects: SuspectWord[] = [
      {
        placeholder: "__PROT_0__",
        originalText: "Noota",
        offset: 0,
        length: 5,
        wasCorrected: false,
      },
    ];
    const { text } = restoreEntities(ltText, suspects);
    expect(text).toBe("Noota est super");
  });

  it("handles corrupted placeholders", () => {
    const ltText = "CORRUPTED est super";
    const suspects: SuspectWord[] = [
      {
        placeholder: "__PROT_0__",
        originalText: "Noota",
        offset: 0,
        length: 5,
        wasCorrected: false,
      },
    ];
    const { suspects: updated } = restoreEntities(ltText, suspects);
    expect(updated[0].wasCorrected).toBe(true);
  });
});
