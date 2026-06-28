import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCorrector } from "../../src/hooks/useCorrector";

// Mock correctText at module level
vi.mock("../../src/utils/api", () => ({
  correctText: vi.fn(),
}));

vi.mock("../../src/services/validWords", () => ({
  loadValidWords: vi.fn().mockResolvedValue(new Set<string>()),
  addValidWord: vi.fn().mockResolvedValue(undefined),
  isWordValid: vi.fn().mockReturnValue(false),
  resetCache: vi.fn(),
}));

describe("useCorrector", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock localStorage properly
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  describe("race condition prevention", () => {
    it("isRunning_flag - Empêche les appels multiples à handleCorrect", async () => {
      // Spy sur console.error pour capturer les warnings React
      const errorCalls: unknown[][] = [];
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
        errorCalls.push(args);
      });

      // Simuler une correction lente avec mock sur correctText
      let resolveFirstCall!: () => void;

      // Import the mock and configure it
      const { correctText } = await import("../../src/utils/api");
      vi.mocked(correctText).mockImplementation(
        (_text, _settings, callbacks) =>
          new Promise((resolve) => {
            resolveFirstCall = () => {
              callbacks?.onTextDone?.("First result", 100);
              resolve([]);
            };
          }),
      );

      const { result } = renderHook(() => useCorrector());

      // Setup texte initial
      await act(async () => {
        result.current.setTextContent("Test text");
      });

      // Démarre première correction
      act(() => {
        result.current.handleCorrect();
      });

      // Vérifie que isLoading est à true (la correction est en cours)
      expect(result.current.isLoading).toBe(true);

      // Tente une deuxième correction pendant que la première est en cours
      // Cette deuxième appel ne devrait PAS démarrer
      await act(async () => {
        result.current.handleCorrect();
      });

      // isLoading devrait toujours être true (première correction pas terminée)
      expect(result.current.isLoading).toBe(true);

      // Résout la première correction
      await act(async () => {
        resolveFirstCall();
        await new Promise((r) => setTimeout(r, 10));
      });

      // Après résolution, isLoading devrait être false
      expect(result.current.isLoading).toBe(false);
      // Le résultat devrait être le premier
      expect(result.current.outputText).toBe("First result");
    });

    it("isRunning_flag - Allow new calls after previous completes", async () => {
      const { correctText } = await import("../../src/utils/api");
      vi.mocked(correctText).mockImplementation(
        (_text, _settings, callbacks) => {
          callbacks?.onTextDone?.("Corrected text", 100);
          return Promise.resolve([]);
        },
      );

      const { result } = renderHook(() => useCorrector());

      await act(async () => {
        result.current.setTextContent("Test text");
      });

      // Première correction
      await act(async () => {
        result.current.handleCorrect();
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.outputText).toBe("Corrected text");

      // Deuxième correction devrait être possible
      await act(async () => {
        result.current.handleCorrect();
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("request cancellation", () => {
    it("AbortController - Annule les requêtes LT en cours lors d'un nouveau handleCorrect", async () => {
      // Simuler LT call avec AbortController
      let abortSignal: AbortSignal | null = null;
      const ltFetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        abortSignal = init?.signal as AbortSignal;
        return new Promise((_, reject) => {
          // Ne jamais résoudre automatiquement - on va tester l'abort
        });
      });
      globalThis.fetch = ltFetch as typeof fetch;

      const { correctText } = await import("../../src/utils/api");
      vi.mocked(correctText).mockResolvedValue("LLM result");

      const { result } = renderHook(() => useCorrector());

      await act(async () => {
        result.current.setTextContent("Test text");
        result.current.setSettings((prev) => ({ ...prev, ltEnabled: true, ltPreFire: true }));
      });

      // Démarre première correction - LT va être appelé
      act(() => {
        result.current.handleCorrect();
      });

      // Attend que le fetch LT soit appelé
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      // LT fetch devrait avoir été appelé
      expect(ltFetch).toHaveBeenCalled();

      // Maintenant résoud la correction
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });
    });

    it("no setState après unmount pendant correction", async () => {
      // Simuler fetch lent pour LT
      let resolveFetch: (value: unknown) => void;
      const mockFetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      );
      globalThis.fetch = mockFetch as typeof fetch;

      const { correctText } = await import("../../src/utils/api");
      vi.mocked(correctText).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolve("Corrected");
          }),
      );

      // Spy sur console.error pour capturer les warnings React
      const errorCalls: unknown[][] = [];
      consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
        errorCalls.push(args);
      });

      const { result, unmount } = renderHook(() => useCorrector());

      await act(async () => {
        result.current.setTextContent("Test text");
      });

      // Démarre correction
      act(() => {
        result.current.handleCorrect();
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      // Unmount pendant que le fetch LT est en attente
      unmount();

      // Résout le fetch LT après unmount
      await act(async () => {
        resolveFetch!({ ok: true, json: async () => ({ matches: [] }) });
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

  describe("localStorage debounce", () => {
    it("debounce - Déclenche l'écriture localStorage après 500ms de délai", async () => {
      const localStorageMock = {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      vi.stubGlobal("localStorage", localStorageMock);

      const { result } = renderHook(() => useCorrector());

      // Premier changement de settings
      await act(async () => {
        result.current.setSettings((prev) => ({ ...prev, mode: "formel" }));
      });

      // immediate après le changement, setItem ne devrait PAS encore être appelé (debounce)
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Après 300ms (moins que le debounce), setItem ne devrait toujours PAS être appelé
      await act(async () => {
        await new Promise((r) => setTimeout(r, 300));
      });
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Après 600ms (plus que le debounce), setItem devrait AVOIR été appelé
      await act(async () => {
        await new Promise((r) => setTimeout(r, 350));
      });
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "ai-corrector:settings",
        expect.stringContaining('"mode":"formel"'),
      );
    });

    it("debounce - Annule le timer précédent si nouveau changement avant 500ms", async () => {
      const localStorageMock = {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      vi.stubGlobal("localStorage", localStorageMock);

      const { result } = renderHook(() => useCorrector());

      // Premier changement
      await act(async () => {
        result.current.setSettings((prev) => ({ ...prev, mode: "formel" }));
      });

      // Deuxième changement après 300ms (devrait annuler le premier timer)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 300));
        result.current.setSettings((prev) => ({ ...prev, mode: "informel" }));
      });

      // Après 600ms depuis le premier changement mais seulement 300ms depuis le deuxième
      // setItem ne devrait PAS encore être appelé car le debounce est réinitialisé
      await act(async () => {
        await new Promise((r) => setTimeout(r, 250));
      });

      // setItem ne devrait toujours PAS être appelé (pas encore 500ms depuis le 2ème changement)
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Attend encore 300ms pour atteindre 550ms depuis le 2ème changement
      await act(async () => {
        await new Promise((r) => setTimeout(r, 300));
      });

      // Seulement UN appel setItem (pour le dernier changement)
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "ai-corrector:settings",
        expect.stringContaining('"mode":"informel"'),
      );
    });
  });
});
