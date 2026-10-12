import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bundleArchiveHash, readLocalUpdate, withLocalUpdates } from "./localUpdater";
import type { UpdateStatus } from "@/shared/ipc";

describe.skipIf(process.platform !== "darwin")("local macOS updates", () => {
  let root: string;
  const appId = "com.franciszek.poracode.personal";
  async function bundle(name: string, value: string) {
    const path = join(root, name);
    await mkdir(join(path, "Contents/MacOS"), { recursive: true });
    await mkdir(join(path, "Contents/Resources"), { recursive: true });
    await copyFile("/usr/bin/true", join(path, "Contents/MacOS/App"));
    await writeFile(
      join(path, "Contents/Info.plist"),
      `<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${appId}</string><key>CFBundleExecutable</key><string>App</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.8.1</string></dict></plist>`,
    );
    await writeFile(join(path, "Contents/Resources/app.asar"), value);
    execFileSync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", path], {
      stdio: "pipe",
    });
    return path;
  }
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "orzi-local-update-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  async function fixture() {
    const targetBundle = await bundle("Orzi Code.app", "old");
    const bundlePath = await bundle("local-updates/new/Orzi Code.app", "new");
    const manifest = {
      version: 1,
      appId,
      appVersion: "1.8.1",
      createdAt: Date.now(),
      bundlePath,
      sha256: await bundleArchiveHash(bundlePath),
    };
    await writeFile(join(root, "local-updates/ready.json"), JSON.stringify(manifest));
    return { manifest, options: { baseDir: root, targetBundle, appId } };
  }
  it("offers an actual signed bundle even when the app version has not changed", async () => {
    const { options, manifest } = await fixture();
    await expect(readLocalUpdate(options)).resolves.toEqual(manifest);
    await copyFile(
      join(manifest.bundlePath, "Contents/Resources/app.asar"),
      join(options.targetBundle, "Contents/Resources/app.asar"),
    );
    await copyFile(
      join(manifest.bundlePath, "Contents/_CodeSignature/CodeResources"),
      join(options.targetBundle, "Contents/_CodeSignature/CodeResources"),
    );
    await expect(readLocalUpdate(options)).resolves.toBeUndefined();
  });
  it("rejects corrupt and previous-generation manifests", async () => {
    const { options, manifest } = await fixture();
    await writeFile(join(manifest.bundlePath, "Contents/Resources/app.asar"), "corrupt");
    await expect(readLocalUpdate(options)).rejects.toThrow("checksum");
    await writeFile(
      join(root, "local-updates/ready.json"),
      JSON.stringify({ ...manifest, version: 0 }),
    );
    await expect(readLocalUpdate(options)).rejects.toThrow(/Invalid input/);
  });
  it("keeps the update available while active work blocks installation", async () => {
    const { options } = await fixture();
    const onStatus = vi.fn<(status: UpdateStatus) => void>();
    const quit = vi.fn<() => void>();
    const controller = withLocalUpdates({
      ...options,
      enabled: true,
      installerPath: "unused",
      onStatus,
      quit,
      isBusy: async () => true,
      release: {
        initialize() {},
        getStatus: () => null,
        checkForUpdate: async () => {},
        startUpdateDownload: async () => {},
        installUpdate() {},
      },
    });
    await controller.checkForUpdate();
    controller.installUpdate();
    await vi.waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith({ type: "error", messageKey: "update.activeTasks" }),
    );
    expect(quit).not.toHaveBeenCalled();
    expect(controller.getStatus()?.type).toBe("downloaded");
  });
});
