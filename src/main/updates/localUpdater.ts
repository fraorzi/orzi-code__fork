import { createHash } from "node:crypto";
import { openSync, closeSync } from "node:fs";
import { readFile, stat, mkdir, copyFile, writeFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { localUpdateManifestSchema, type LocalUpdateManifest } from "@/shared/localUpdate";
import type { UpdateStatus } from "@/shared/ipc";
import type { AutoUpdaterController } from "./autoUpdater";

const execFileAsync = promisify(execFile);
// Electron's patched fs treats app.asar as a directory. Hash the actual signed
// archive bytes; ordinary Node tests use the native fs implementation.
const readBundleFile: typeof readFile = process.versions.electron
  ? createRequire(process.execPath)("original-fs").promises.readFile
  : readFile;

interface LocalUpdaterOptions {
  release: AutoUpdaterController;
  baseDir: string;
  targetBundle: string;
  installerPath: string;
  appId: string;
  enabled: boolean;
  onStatus(status: UpdateStatus): void;
  isBusy(): Promise<boolean>;
  quit(): void;
}

export async function bundleArchiveHash(bundlePath: string): Promise<string> {
  return createHash("sha256")
    .update(await readBundleFile(join(bundlePath, "Contents/Resources/app.asar")))
    .update(await readBundleFile(join(bundlePath, "Contents/_CodeSignature/CodeResources")))
    .digest("hex");
}

/** The running app may install only its own staged bundle, never a manifest-supplied target. */
export async function readLocalUpdate(
  options: Pick<LocalUpdaterOptions, "baseDir" | "appId" | "targetBundle">,
): Promise<LocalUpdateManifest | undefined> {
  const manifest = localUpdateManifestSchema.parse(
    JSON.parse(await readFile(join(options.baseDir, "local-updates/ready.json"), "utf8")),
  );
  if (manifest.appId !== options.appId)
    throw new Error("Local update application identity mismatch.");
  const nested = relative(resolve(options.baseDir, "local-updates"), resolve(manifest.bundlePath));
  if (!nested || nested.startsWith("..") || nested.startsWith("/"))
    throw new Error("Local update is outside its staging directory.");
  if ((await bundleArchiveHash(options.targetBundle)) === manifest.sha256) return undefined;
  if ((await bundleArchiveHash(manifest.bundlePath)) !== manifest.sha256)
    throw new Error("Local update archive checksum mismatch.");
  await execFileAsync("/usr/bin/codesign", ["--verify", "--deep", "--strict", manifest.bundlePath]);
  const { stdout } = await execFileAsync("/usr/libexec/PlistBuddy", [
    "-c",
    "Print :CFBundleIdentifier",
    join(manifest.bundlePath, "Contents/Info.plist"),
  ]);
  if (stdout.trim() !== options.appId) throw new Error("Local update bundle identity mismatch.");
  return manifest;
}

export function withLocalUpdates(options: LocalUpdaterOptions): AutoUpdaterController {
  if (!options.enabled) return options.release;
  let ready: LocalUpdateManifest | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastMtime = -1;
  let checking = false;
  let installing = false;
  const status = (): UpdateStatus | null =>
    ready
      ? { type: "downloaded", version: ready.appVersion, buildId: ready.sha256 }
      : options.release.getStatus();
  async function check(force = false): Promise<void> {
    if (checking || installing) return;
    checking = true;
    try {
      const metadata = await stat(join(options.baseDir, "local-updates/ready.json"));
      if (!force && metadata.mtimeMs === lastMtime) return;
      lastMtime = metadata.mtimeMs;
      ready = await readLocalUpdate(options);
      const current = status();
      options.onStatus(current ?? { type: "update-not-available" });
    } catch (error) {
      ready = undefined;
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        console.warn("[local-update] staged update validation failed", error);
        options.onStatus({ type: "error", messageKey: "update.operationFailed" });
      }
    } finally {
      checking = false;
    }
  }
  async function install(): Promise<void> {
    if (installing) return;
    installing = true;
    try {
      const selected = await readLocalUpdate(options);
      if (!selected) return;
      if (await options.isBusy()) {
        options.onStatus({ type: "error", messageKey: "update.activeTasks" });
        options.onStatus({
          type: "downloaded",
          version: selected.appVersion,
          buildId: selected.sha256,
        });
        return;
      }
      const dir = join(options.baseDir, "local-updates");
      await mkdir(dir, { recursive: true });
      // The helper must survive replacement of the bundle it came from.
      const installer = join(dir, "install.py");
      await copyFile(options.installerPath, installer);
      const log = openSync(join(dir, "install.log"), "a", 0o600);
      try {
        const child = spawn(
          "/usr/bin/python3",
          [
            "-I",
            installer,
            "install",
            "--profile",
            options.baseDir,
            "--target",
            options.targetBundle,
            "--wait-pid",
            String(process.pid),
            "--sha256",
            selected.sha256,
          ],
          { detached: true, stdio: ["ignore", log, log] },
        );
        await new Promise<void>((done, fail) => {
          child.once("spawn", done);
          child.once("error", fail);
        });
        child.unref();
      } finally {
        closeSync(log);
      }
      options.quit();
    } catch (error) {
      console.warn("[local-update] install failed", error);
      options.onStatus({ type: "error", messageKey: "update.operationFailed" });
    } finally {
      installing = false;
    }
  }
  return {
    initialize() {
      if (timer) return;
      options.release.initialize();
      void check();
      timer = setInterval(() => void check(), 3000);
      timer.unref();
      // The detached installer waits for the new main process to initialize.
      void bundleArchiveHash(options.targetBundle)
        .then(async (sha256) => {
          const dir = join(options.baseDir, "local-updates");
          await mkdir(dir, { recursive: true });
          await writeFile(join(dir, "started.json"), JSON.stringify({ sha256, pid: process.pid }), {
            mode: 0o600,
          });
        })
        .catch(() => {});
    },
    getStatus: status,
    async checkForUpdate() {
      await check(true);
      if (!ready) await options.release.checkForUpdate();
    },
    async startUpdateDownload() {
      if (!ready) await options.release.startUpdateDownload();
    },
    installUpdate() {
      if (ready) void install();
      else if (options.release.getStatus()?.type === "downloaded") options.release.installUpdate();
    },
  };
}
