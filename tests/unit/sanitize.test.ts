import { describe, expect, it } from "vitest";
import { sanitizeInput } from "../../src/utils/sanitize";

describe("sanitizeInput", () => {
  it("texte vide → throw", () => {
    expect(() => sanitizeInput("   ")).toThrow("Le texte ne peut pas être vide");
  });

  it("retire les caractères de contrôle", () => {
    expect(sanitizeInput("bonjour\x00monde")).toBe("bonjourmonde");
  });

  it("conserve les newlines et tabs", () => {
    expect(sanitizeInput("ligne1\nligne2\ttab")).toBe("ligne1\nligne2\ttab");
  });

  it("tronque à 10000 caractères", () => {
    const long = "a".repeat(15000);
    expect(sanitizeInput(long).length).toBe(10000);
  });

  it("trim le whitespace superflu", () => {
    expect(sanitizeInput("  bonjour  ")).toBe("bonjour");
  });
});
