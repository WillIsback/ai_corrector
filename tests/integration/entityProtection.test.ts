import { describe, expect, it } from "vitest";
import { detectEntities, markEntitiesInOutput } from "../../src/services/entityDetector";

describe("Entity detection and marking pipeline", () => {
  it("detects entities in input and marks them in corrected output", () => {
    const inputText = "Bonjour, tu connais Noota ?";
    const outputText = "Bonjour, connaissez-vous Noota ?";

    // Step 1: detect entities in input
    const entities = detectEntities(inputText, new Set());
    expect(entities).toContain("Noota");

    // Step 2: mark entities in the corrected output
    const suspects = markEntitiesInOutput(outputText, entities);
    expect(suspects).toHaveLength(1);
    expect(suspects[0].originalText).toBe("Noota");
    expect(suspects[0].offset).toBe(outputText.indexOf("Noota"));
  });

  it("handles text with no entities", () => {
    const inputText = "Bonjour, comment allez-vous ?";
    const outputText = "Bonjour, comment allez-vous ?";
    const entities = detectEntities(inputText, new Set());
    expect(entities).toHaveLength(0);

    const suspects = markEntitiesInOutput(outputText, entities);
    expect(suspects).toHaveLength(0);
  });

  it("preserves valid words from detection", () => {
    const text = "Noota est super";
    const validWords = new Set(["Noota"]);
    const entities = detectEntities(text, validWords);
    expect(entities).not.toContain("Noota");
  });

  it("handles multiple entities in corrected output", () => {
    const inputText = "Voici Jean, il utilise Noota et Slack au travail.";
    const outputText = "Voici Jean, il utilise Noota et Slack tous les jours.";

    const entities = detectEntities(inputText, new Set());
    const suspects = markEntitiesInOutput(outputText, entities);

    const suspectTexts = suspects.map((s) => s.originalText);
    expect(suspectTexts).toContain("Noota");
    // Slack may be detected as "Slack" or "Slack." depending on the heuristic
    const hasSlack = suspectTexts.some((t) => t.startsWith("Slack"));
    expect(hasSlack).toBe(true);
  });

  it("offsets are correct when LLM changes text length", () => {
    // Input: "tu connais" (10 chars) → Output: "connaissez-vous" (15 chars)
    // Noota's offset shifts, but markEntitiesInOutput finds it at the right position
    const inputText = "Bonjour, tu connais Noota ?";
    const outputText = "Bonjour, connaissez-vous Noota ici.";

    const entities = detectEntities(inputText, new Set());
    const suspects = markEntitiesInOutput(outputText, entities);

    const nootaSuspect = suspects.find((s) => s.originalText === "Noota");
    expect(nootaSuspect).toBeDefined();
    expect(nootaSuspect?.offset).toBe(outputText.indexOf("Noota"));
    // Noota should NOT be at the same offset as "vous"
    expect(nootaSuspect?.offset).not.toBe(outputText.indexOf("vous"));
  });
});
