import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("PORT defaults to 25000", async () => {
    const { config } = await import("../../config");
    expect(config.port).toBe(25000);
  });

  it("PORT reads from env var", async () => {
    vi.stubEnv("PORT", "9000");
    const { config } = await import("../../config");
    expect(config.port).toBe(9000);
  });

  it("llmDisableThinking defaults to true", async () => {
    const { config } = await import("../../config");
    expect(config.llmDisableThinking).toBe(true);
  });

  it("llmDisableThinking=false when LLM_DISABLE_THINKING=false", async () => {
    vi.stubEnv("LLM_DISABLE_THINKING", "false");
    const { config } = await import("../../config");
    expect(config.llmDisableThinking).toBe(false);
  });

  it("corsOrigins defaults to empty array", async () => {
    const { config } = await import("../../config");
    expect(config.corsOrigins).toEqual([]);
  });

  it("CORS_ORIGIN parses comma-separated list", async () => {
    vi.stubEnv("CORS_ORIGIN", "https://a.com,https://b.com");
    const { config } = await import("../../config");
    expect(config.corsOrigins).toEqual(["https://a.com", "https://b.com"]);
  });

  it("otelEndpoint defaults to empty string", async () => {
    const { config } = await import("../../config");
    expect(config.otelEndpoint).toBe("");
  });
});
