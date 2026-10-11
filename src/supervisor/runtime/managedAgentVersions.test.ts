import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ManagedAgentVersions } from "./managedAgentVersions";
import { getManagedExecutable, setManagedExecutable } from "../agents/managedExecutable";
import { resolveAgentBinaryPath } from "../agents/binaryResolver";
import { resolveExecutablePath, resolveExecutablePathAsync } from "../agents/base";

const execFileAsync = promisify(execFile);
const capability = {
  npmPackage: "@fixture/runtime",
  binary: "fixture-runtime",
  async verifyInstallation(path: string) {
    const result = await execFileAsync(path, ["--probe"]);
    if (result.stdout.trim() !== "protocol:1") throw new Error("Incompatible fixture protocol");
  },
};

describe("managed native agent versions", () => {
  let root: string;
  let badProtocol: boolean;
  let wrongVersion: boolean;
  async function install(_capability: typeof capability, version: string, directory: string) {
    const pkg = join(directory, "node_modules", "@fixture", "runtime");
    mkdirSync(pkg, { recursive: true });
    mkdirSync(join(directory, "node_modules", ".bin"), { recursive: true });
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({ name: capability.npmPackage, version }),
    );
    writeFileSync(join(pkg, "assets.txt"), badProtocol ? "protocol:0" : "protocol:1");
    writeFileSync(
      join(pkg, "cli.cjs"),
      `#!${process.execPath}\nconst fs=require('node:fs'); const path=require('node:path'); console.log(process.argv.includes('--probe') ? fs.readFileSync(path.join(__dirname,'assets.txt'),'utf8') : 'runtime ${wrongVersion ? "0.0.0" : version}');`,
      { mode: 0o755 },
    );
    symlinkSync(
      "../@fixture/runtime/cli.cjs",
      join(directory, "node_modules", ".bin", capability.binary),
    );
    writeFileSync(
      join(directory, "package-lock.json"),
      JSON.stringify({
        packages: {
          [`node_modules/${capability.npmPackage}`]: { version, integrity: "sha512-fixture" },
        },
      }),
    );
  }
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "orzi-managed-agent-"));
    badProtocol = false;
    wrongVersion = false;
    setManagedExecutable(capability.binary, undefined);
  });
  afterEach(() => {
    setManagedExecutable(capability.binary, undefined);
    rmSync(root, { recursive: true, force: true });
  });
  const manager = () => new ManagedAgentVersions(root, [capability], { install });

  it("installs the complete package and pins detection and native launch to the same runtime", async () => {
    const versions = manager();
    await versions.install(capability, "1.0.0");
    const path = getManagedExecutable(capability.binary);
    expect(path).toBeTruthy();
    expect(resolveExecutablePath(capability.binary)).toBe(path);
    expect(await resolveExecutablePathAsync(capability.binary)).toBe(path);
    expect(resolveAgentBinaryPath({ kind: "posix", path: root }, capability.binary)).toBe(path);
    expect(
      resolveAgentBinaryPath(
        { kind: "wsl", distro: "fixture", linuxPath: "/tmp", uncPath: "fixture" },
        capability.binary,
      ),
    ).toBeUndefined();
    expect(versions.state(capability)).toEqual({ supported: true, active: "1.0.0" });
    expect(versions.isPinned(capability)).toBe(true);
  });

  it("retains two complete versions, verifies rollback, and survives restart", async () => {
    const versions = manager();
    await versions.install(capability, "1.0.0");
    const first = getManagedExecutable(capability.binary);
    await versions.install(capability, "2.0.0");
    await versions.rollback(capability);
    expect(getManagedExecutable(capability.binary)).toBe(first);
    expect(manager().state(capability)).toEqual({
      supported: true,
      active: "1.0.0",
      previous: "2.0.0",
    });
    expect(getManagedExecutable(capability.binary)).toBe(first);
  });

  it("keeps activation and manifest unchanged when a candidate fails its protocol probe", async () => {
    const versions = manager();
    await versions.install(capability, "1.0.0");
    const before = readFileSync(join(root, "agent-versions", "active.json"), "utf8");
    const path = getManagedExecutable(capability.binary);
    badProtocol = true;
    await expect(versions.install(capability, "2.0.0")).rejects.toThrow("Incompatible");
    expect(getManagedExecutable(capability.binary)).toBe(path);
    expect(readFileSync(join(root, "agent-versions", "active.json"), "utf8")).toBe(before);
  });

  it("rejects a mismatched CLI version before activation", async () => {
    wrongVersion = true;
    await expect(manager().install(capability, "1.0.0")).rejects.toThrow("Executable version");
    expect(getManagedExecutable(capability.binary)).toBeUndefined();
  });

  it("revalidates the previous runtime rather than blindly switching the path", async () => {
    const versions = manager();
    await versions.install(capability, "1.0.0");
    const first = getManagedExecutable(capability.binary);
    if (!first) throw new Error("Fixture was not installed");
    writeFileSync(join(first, "..", "..", "@fixture", "runtime", "assets.txt"), "protocol:0");
    await versions.install(capability, "2.0.0");
    await expect(versions.rollback(capability)).rejects.toThrow("Incompatible");
    expect(versions.state(capability)).toEqual({
      supported: true,
      active: "2.0.0",
      previous: "1.0.0",
    });
  });

  it("returns to the external installation without removing managed packages", async () => {
    const versions = manager();
    await versions.install(capability, "1.0.0");
    const path = getManagedExecutable(capability.binary);
    versions.useSystem(capability);
    expect(getManagedExecutable(capability.binary)).toBeUndefined();
    expect(versions.isPinned(capability)).toBe(false);
    expect(manager().state(capability)).toEqual({ supported: true });
    if (!path) throw new Error("Fixture was not installed");
    expect((await execFileAsync(path, ["--probe"])).stdout.trim()).toBe("protocol:1");
  });

  it.each(["latest", "../1.0.0", "1.0", "1.0.0;echo", "01.0.0"])(
    "rejects non-exact version %s",
    async (version) => {
      await expect(manager().install(capability, version)).rejects.toThrow(/Invalid/);
      expect(getManagedExecutable(capability.binary)).toBeUndefined();
    },
  );

  it("preserves unknown store versions and blocks fallback to an unpinned executable", async () => {
    mkdirSync(join(root, "agent-versions"));
    const manifest = join(root, "agent-versions", "active.json");
    writeFileSync(manifest, '{"version":999,"records":[]}');
    const versions = manager();
    expect(versions.state(capability)).toMatchObject({
      supported: true,
      error: expect.any(String),
    });
    expect(() => getManagedExecutable(capability.binary)).toThrow("repair");
    await expect(versions.install(capability, "1.0.0")).rejects.toThrow("repair");
    expect(readFileSync(manifest, "utf8")).toBe('{"version":999,"records":[]}');
  });
});
