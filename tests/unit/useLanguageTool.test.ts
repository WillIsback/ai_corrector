import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLanguageTool } from "../../src/hooks/useLanguageTool";

describe("useLanguageTool", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  describe("cleanup behavior", () => {
    it("ne pas appeler setState après unmount - évite React Warning", async () => {
      // Mock fetch pour que checkLTAvailable soit lent
      let resolveFetch: (value: unknown) => void;
      const mockFetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      );
      globalThis.fetch = mockFetch as typeof fetch;

      // Spy sur console.error pour capturer les warnings React
      const errorCalls: unknown[][] = [];
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
        errorCalls.push(args);
      });

      // Render du hook
      const { unmount } = renderHook(() => useLanguageTool());

      // Allow async check to start
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      // Unmount pendant que le check est en cours
      unmount();

      // Maintenant on résout le fetch - si le cleanup est manquant,
      // setIsAvailable sera appelé sur un unmounted component et causera un warning
      await act(async () => {
        resolveFetch!({ ok: true });
        await new Promise((r) => setTimeout(r, 50));
      });

      // Vérifie qu'aucun warning React "unmounted component" n'a été émis
      const unmountWarning = errorCalls.find((call) =>
        call.some(
          (arg) =>
            typeof arg === "string" &&
            (arg.includes("Warning: An update to") || arg.includes("setState")),
        ),
      );

      expect(unmountWarning).toBeUndefined();
    });
  });
});
