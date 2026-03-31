import { describe, expect, it } from "vitest";
import { computeDiff, mergeDiffs } from "../../src/utils/diff";

describe("computeDiff", () => {
  it("computeDiff_noChange - Identique → chunk unchanged", () => {
    const result = computeDiff("hello", "hello");
    expect(result).toEqual([{ type: "unchanged" as const, text: "hello" }]);
  });

  it("computeDiff_added - Ajout → chunk added avec source", () => {
    const result = computeDiff("hello", "hello world");
    expect(result).toEqual([
      { type: "unchanged" as const, text: "hello" },
      { type: "added" as const, text: " world", source: "llm" },
    ]);
  });

  it("computeDiff_removed - Suppression → chunk removed", () => {
    const result = computeDiff("hello world", "hello");
    expect(result).toEqual([
      { type: "unchanged" as const, text: "hello" },
      { type: "removed" as const, text: " world" },
    ]);
  });

  it("computeDiff_source_llm - Source par défaut = llm", () => {
    const result = computeDiff("", "new");
    expect(result).toEqual([{ type: "added" as const, text: "new", source: "llm" }]);
  });

  it("computeDiff_source_lt_pre - Source = lt_pre", () => {
    const result = computeDiff("", "new", "lt_pre");
    expect(result).toEqual([{ type: "added" as const, text: "new", source: "lt_pre" }]);
  });

  it("computeDiff_source_lt_post - Source = lt_post", () => {
    const result = computeDiff("", "new", "lt_post");
    expect(result).toEqual([{ type: "added" as const, text: "new", source: "lt_post" }]);
  });
});

describe("mergeDiffs", () => {
  it("mergeDiffs_adjacentSameSource - Adjacents même source → fusionnés", () => {
    const chunks1 = [{ type: "added" as const, text: "hello", source: "llm" as const }];
    const chunks2 = [{ type: "added" as const, text: " world", source: "llm" as const }];

    const result = mergeDiffs(chunks1, chunks2);

    expect(result).toEqual([
      { type: "added" as const, text: "hello world", source: "llm" as const },
    ]);
  });

  it("mergeDiffs_adjacentDiffSource - Adjacents source différent → non fusionnés", () => {
    const chunks1 = [{ type: "added" as const, text: "hello", source: "llm" as const }];
    const chunks2 = [{ type: "added" as const, text: " world", source: "lt_pre" as const }];

    const result = mergeDiffs(chunks1, chunks2);

    expect(result).toEqual([
      { type: "added" as const, text: "hello", source: "llm" as const },
      { type: "added" as const, text: " world", source: "lt_pre" as const },
    ]);
  });

  it("mergeDiffs_immutability - Pas de mutation des tableaux originaux", () => {
    const chunks1 = [{ type: "unchanged" as const, text: "original" }];
    const chunks2 = [{ type: "added" as const, text: " added", source: "llm" as const }];

    const originalChunks1 = JSON.stringify(chunks1);
    const originalChunks2 = JSON.stringify(chunks2);

    mergeDiffs(chunks1, chunks2);

    expect(JSON.stringify(chunks1)).toBe(originalChunks1);
    expect(JSON.stringify(chunks2)).toBe(originalChunks2);
  });
});
