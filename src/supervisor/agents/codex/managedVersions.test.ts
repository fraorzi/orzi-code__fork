import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyCodexInstallation } from "./probe";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("managed Codex runtime verification", () => {
  function fixture(reject: boolean): string {
    const root = mkdtempSync(join(tmpdir(), "orzi-codex-protocol-"));
    roots.push(root);
    const path = join(root, "codex");
    writeFileSync(
      path,
      `#!${process.execPath}
const readline=require('node:readline');
readline.createInterface({input:process.stdin}).on('line',line=>{
const request=JSON.parse(line);if(!request.id)return;
const response=${reject} ? {error:{code:-32601,message:'unsupported'}} : {result:request.method==='initialize'?{userAgent:'fixture'}:{requirements:null}};
console.log(JSON.stringify({id:request.id,...response}));
});`,
      { mode: 0o755 },
    );
    return path;
  }
  it("completes initialize and the required config protocol without starting a thread", async () => {
    await expect(verifyCodexInstallation(fixture(false))).resolves.toBeUndefined();
  });
  it("rejects a runtime that cannot speak the required protocol", async () => {
    await expect(verifyCodexInstallation(fixture(true))).rejects.toThrow("handshake");
  });
  it.skipIf(!process.env.ORZI_TEST_CODEX_PATH)(
    "verifies an explicitly selected real CLI without a model turn",
    async () => {
      const path = process.env.ORZI_TEST_CODEX_PATH;
      if (!path) throw new Error("Missing real CLI path");
      await expect(verifyCodexInstallation(path)).resolves.toBeUndefined();
    },
  );
});
