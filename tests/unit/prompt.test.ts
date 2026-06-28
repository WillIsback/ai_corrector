import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "../../src/utils/prompt";
import type { CorrectionSettings } from "../../src/types";

const base: CorrectionSettings = {
  engine: "llm",
  mode: "formel",
  fixGrammar: true,
  fixSpelling: true,
  fixSyntax: true,
  fixStyle: true,
  showCorrections: true,
};

describe("buildSystemPrompt", () => {
  it("inclut la description du mode formel", () => {
    expect(buildSystemPrompt(base)).toContain("Formel et professionnel");
  });

  it("inclut la description du mode informel", () => {
    expect(buildSystemPrompt({ ...base, mode: "informel" })).toContain("Decontracte");
  });

  it("showCorrections: true → JSON avec champ corrections", () => {
    expect(buildSystemPrompt({ ...base, showCorrections: true })).toContain('"corrections"');
  });

  it("showCorrections: false → JSON sans champ corrections", () => {
    const prompt = buildSystemPrompt({ ...base, showCorrections: false });
    expect(prompt).not.toContain('"corrections"');
    expect(prompt).toContain('"texte_corrige"');
  });

  it("liste les corrections actives", () => {
    const prompt = buildSystemPrompt({ ...base, fixGrammar: true, fixSpelling: false, fixSyntax: false, fixStyle: false });
    expect(prompt).toContain("grammaire");
    expect(prompt).not.toContain("orthographe");
  });
});

describe("buildUserPrompt", () => {
  it("retourne le texte tel quel", () => {
    expect(buildUserPrompt("Mon texte")).toBe("Mon texte");
  });
});
