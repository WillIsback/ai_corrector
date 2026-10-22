import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression test for the v1.5.14 incident (2026-10-23): server.ts imported a
// new ./src/utils/llmJson.ts, but the runtime stage of the Dockerfile copies
// server files one by one, so the container crash-looped with
// "Cannot find module './src/utils/llmJson.ts'". Every relative import of the
// server entrypoint must be copied into the runtime image.

const root = join(import.meta.dirname, "../..");
const dockerfile = readFileSync(join(root, "Dockerfile"), "utf-8");
const serverSource = readFileSync(join(root, "server.ts"), "utf-8");

describe("Dockerfile runtime stage", () => {
  const copied = dockerfile
    .split("\n")
    .filter((line) => line.startsWith("COPY ") && !line.includes("--from="))
    .flatMap((line) => line.split(/\s+/).slice(1, -1));

  const localImports = [...serverSource.matchAll(/from "\.\/([^"]+)"|import "\.\/([^"]+)"/g)].map(
    (m) => m[1] ?? m[2],
  );

  it.each(localImports)("copies %s imported by server.ts", (file) => {
    expect(copied).toContain(file);
  });
});
