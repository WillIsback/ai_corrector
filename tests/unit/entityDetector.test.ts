import { describe, expect, it } from "vitest";
import { detectEntities, markEntitiesInOutput } from "../../src/services/entityDetector";

describe("detectEntities", () => {
  it("detects proper nouns as entity names", () => {
    const text = "L'application Noota est française";
    const entities = detectEntities(text, new Set());
    expect(entities).toContain("Noota");
  });

  it("excludes words from validWords set", () => {
    const text = "Noota est super";
    const validWords = new Set(["Noota"]);
    const entities = detectEntities(text, validWords);
    expect(entities).not.toContain("Noota");
  });

  it("excludes words at start of sentence", () => {
    const text = "Application est importante.";
    const entities = detectEntities(text, new Set());
    expect(entities).not.toContain("Application");
  });

  it("does not flag words after French contractions as entities", () => {
    const text = "L'Application est française";
    const entities = detectEntities(text, new Set());
    expect(entities).not.toContain("Application");
  });

  it("detects multiple entities", () => {
    const text = "J'utilise Noota et Slack au travail.";
    const entities = detectEntities(text, new Set());
    expect(entities).toContain("Noota");
    expect(entities).toContain("Slack");
  });

  it("deduplicates entities", () => {
    const text = "Noota est bien. J'aime Noota aussi.";
    const entities = detectEntities(text, new Set());
    const nootaCount = entities.filter((e) => e === "Noota").length;
    expect(nootaCount).toBe(1);
  });
});

describe("markEntitiesInOutput", () => {
  it("finds entity positions in corrected output", () => {
    const outputText = "Bonjour, connaissez-vous Noota ?";
    const entities = ["Noota"];
    const suspects = markEntitiesInOutput(outputText, entities);
    expect(suspects).toHaveLength(1);
    expect(suspects[0].originalText).toBe("Noota");
    expect(suspects[0].offset).toBe(25);
  });

  it("handles entities that were removed by LLM", () => {
    const outputText = "Bonjour, comment allez-vous ?";
    const entities = ["Noota"];
    const suspects = markEntitiesInOutput(outputText, entities);
    expect(suspects).toHaveLength(0);
  });

  it("handles multiple entities", () => {
    const outputText = "J'utilise Noota et Slack tous les jours.";
    const entities = ["Noota", "Slack"];
    const suspects = markEntitiesInOutput(outputText, entities);
    expect(suspects).toHaveLength(2);
    expect(suspects[0].originalText).toBe("Noota");
    expect(suspects[1].originalText).toBe("Slack");
  });

  it("finds entity at the correct offset in modified text", () => {
    const outputText = "Bonjour, connaissez-vous Noota ?";
    const entities = ["Noota"];
    const suspects = markEntitiesInOutput(outputText, entities);
    expect(suspects[0].offset).toBe(outputText.indexOf("Noota"));
  });

  it("handles case-insensitive matching", () => {
    const outputText = "L'application noota est cool.";
    const entities = ["Noota"];
    const suspects = markEntitiesInOutput(outputText, entities);
    expect(suspects).toHaveLength(1);
    expect(suspects[0].originalText).toBe("noota"); // preserves case from output
  });
});
