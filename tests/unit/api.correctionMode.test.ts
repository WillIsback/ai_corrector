import { describe, it, expect, vi, beforeEach } from "vitest";
import { correctText } from "../../src/utils/api";
import type { CorrectionSettings } from "../../src/types";

const defaultSettings: CorrectionSettings = {
  mode: "formel",
  fixGrammar: true,
  fixSpelling: true,
  fixSyntax: true,
  fixStyle: true,
  showCorrections: true,
  ltEnabled: true,
  ltPreFire: true,
  ltPostFire: false,
};

function makeSseMock(textPayload = "Texte corrigé.", corrections: unknown[] = []) {
  const encoder = new TextEncoder();
  const chunks = [
    encoder.encode(`data: ${JSON.stringify({ text_done: true, text: textPayload, duration: 100 })}\n\n`),
    encoder.encode(`data: ${JSON.stringify({ done: true, corrections })}\n\n`),
  ];
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
  });
}

describe("correctText — correction_mode", () => {
  beforeEach(() => {
    vi.stubGlobal("import.meta", { env: {} });
  });

  it("envoie correction_mode dans le body de la requête LLM", async () => {
    const mockFetch = makeSseMock();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);

    await correctText("Texte a corriger.", { ...defaultSettings, mode: "informel" });

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.correction_mode).toBe("informel");
  });

  it("envoie correction_mode pour chaque mode", async () => {
    for (const mode of ["formel", "semi-formel", "informel", "technical"] as const) {
      const mockFetch = makeSseMock();
      vi.spyOn(global, "fetch").mockImplementation(mockFetch);

      await correctText("Texte.", { ...defaultSettings, mode: mode as CorrectionSettings["mode"] });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.correction_mode).toBe(mode);
    }
  });
});
