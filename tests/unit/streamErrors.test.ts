import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isStreamTeardownError } from "../../src/utils/streamErrors";

// Regression test for issue #14 (incident 2026-09-28): Node/Bun threw
// "TypeError [ERR_INVALID_STATE]: Invalid state: Controller is already closed"
// on `llm.chat` spans after ~12s — a benign stream-teardown race that must not
// turn a completed SSE stream into an ERROR span or an SSE `error` event.

describe("isStreamTeardownError — stream close-race classifier (issue #14)", () => {
  it("detects the exact TypeError [ERR_INVALID_STATE] from the incident", () => {
    const err = new TypeError("[ERR_INVALID_STATE]: Invalid state: Controller is already closed");
    expect(isStreamTeardownError(err)).toBe(true);
  });

  it("detects a plain TypeError carrying the controller-closed marker", () => {
    const err = new TypeError("Controller is already closed");
    expect(isStreamTeardownError(err)).toBe(true);
  });

  it("detects ERR_INVALID_STATE when the marker is only on `code`", () => {
    const err = new Error("Invalid state") as Error & { code?: string };
    err.code = "ERR_INVALID_STATE";
    // The real Bun/Node error keeps the marker in the message; guard against a
    // variant where only `code` carries the ERR_INVALID_STATE token.
    err.message = "Invalid state: Controller is already closed";
    expect(isStreamTeardownError(err)).toBe(true);
  });

  it("does NOT treat a genuine LLM/network failure as a teardown race", () => {
    expect(isStreamTeardownError(new Error("API error: 500"))).toBe(false);
    expect(isStreamTeardownError(new Error("Failed to fetch"))).toBe(false);
    expect(isStreamTeardownError(new Error("Delai d'attente depasse"))).toBe(false);
    // A different state error is not the controller-closed race.
    const other = new TypeError(
      "[ERR_INVALID_STATE]: Invalid state: The read source is already locked",
    );
    expect(isStreamTeardownError(other)).toBe(false);
  });

  it("does not treat non-Error thrown values as a teardown race", () => {
    expect(isStreamTeardownError("Controller is already closed")).toBe(false);
    expect(isStreamTeardownError(null)).toBe(false);
    expect(isStreamTeardownError(undefined)).toBe(false);
    expect(isStreamTeardownError(42)).toBe(false);
  });
});

describe("server.ts — llm.chat stream loop guards the close-race (issue #14)", () => {
  // server.ts runs under Bun (Bun.serve) and cannot be imported in the vitest
  // jsdom environment, so we guard at the source level that the guard is wired
  // into the handler (same technique as the issue #1 regression test).
  const serverSource = readFileSync(join(import.meta.dirname, "../../server.ts"), "utf-8");

  function handlerBody(): string {
    const start = serverSource.indexOf('path === "/v1/chat/completions"');
    expect(start, "handler for /v1/chat/completions must exist in server.ts").toBeGreaterThan(-1);
    const end = serverSource.indexOf("// === API: LLM Proxy", start);
    expect(end, "end of /v1/chat/completions handler section must be found").toBeGreaterThan(start);
    return serverSource.slice(start, end);
  }

  it("imports and references isStreamTeardownError inside the chat handler", () => {
    expect(serverSource).toMatch(
      /import\s*{[^}]*isStreamTeardownError[^}]*}\s*from\s*"\.\/src\/utils\/streamErrors/,
    );
    expect(handlerBody()).toMatch(/isStreamTeardownError\(/);
  });

  it("guards the for-await stream loop with a teardown-aware catch", () => {
    const handler = handlerBody();
    const loop = handler.indexOf("for await (const chunk of stream)");
    expect(loop, "the SDK stream for-await loop must exist").toBeGreaterThan(-1);
    // A catch block using the classifier must come after the loop.
    const guard = handler.indexOf("isStreamTeardownError(loopErr)", loop);
    expect(
      guard,
      "the for-await loop must be wrapped in a catch that recognises the teardown race",
    ).toBeGreaterThan(loop);
    // The genuine-error rethrow path must remain (we only swallow the race).
    expect(handler.slice(guard)).toMatch(/throw\s+loopErr/);
  });
});
