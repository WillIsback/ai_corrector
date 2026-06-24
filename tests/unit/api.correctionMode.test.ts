import { describe, it, expect, vi, beforeEach } from "vitest";
import { correctText } from "../../src/utils/api";
import type { CorrectionSettings } from "../../src/types";

const defaultSettings: CorrectionSettings = {
  mode: "formel",
  fixGrammar: true,
  fixSpelling: true,
  fixSyntax: true,
  fixStyle: true,
  ltEnabled: true,
  ltPreFire: true,
  ltPostFire: false,
};

describe("correctText — correction_mode", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: "test",
          object: "chat.completion",
          created: 0,
          model: "qwen3",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({
                  texte_corrige: "Texte corrigé.",
                  corrections: [],
                }),
              },
              finish_reason: "stop",
            },
          ],
        }),
      })
    );
    vi.stubGlobal("import.meta", { env: {} });
  });

  it("envoie correction_mode dans le body de la requête LLM", async () => {
    await correctText("Texte a corriger.", { ...defaultSettings, mode: "informel" });

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.correction_mode).toBe("informel");
  });

  it("envoie correction_mode pour chaque mode", async () => {
    for (const mode of ["formel", "semi-formel", "informel", "technical"] as const) {
      await correctText("Texte.", { ...defaultSettings, mode: mode as CorrectionSettings["mode"] });
      const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[(fetch as ReturnType<typeof vi.fn>).mock.calls.length - 1];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.correction_mode).toBe(mode);
    }
  });
});
