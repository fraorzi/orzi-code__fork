import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { writeFileAtomic } from "@/shared/atomicFile";
import { exactAgentVersionSchema, type AgentVersionsState } from "@/shared/contracts";
import type { AgentAdapter } from "../agents/base";
import { extractSemverFromVersionOutput } from "../agents/base";
import { setManagedExecutable } from "../agents/managedExecutable";

type Capability = NonNullable<AgentAdapter["managedVersions"]>;
const execFileAsync = promisify(execFile);
// Supervisor-owned activation state. Old releases have no manifest; unknown
// versions are preserved and cannot be overwritten or silently unpinned.
const STORE_VERSION = 1;
const recordSchema = z.object({
  package: z.string().min(1),
  binary: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  active: exactAgentVersionSchema,
  previous: exactAgentVersionSchema.optional(),
});
const storeSchema = z
  .object({ version: z.literal(STORE_VERSION), records: z.array(recordSchema) })
  .refine(
    (store) =>
      new Set(store.records.map((r) => r.package)).size === store.records.length &&
      new Set(store.records.map((r) => r.binary)).size === store.records.length,
    "Managed package and executable identities must be unique.",
  );
type Record = z.infer<typeof recordSchema>;
const packageSchema = z.object({ name: z.string(), version: exactAgentVersionSchema });
const lockSchema = z.object({
  packages: z.record(
    z.string(),
    z.object({ version: z.string().optional(), integrity: z.string().optional() }).passthrough(),
  ),
});

export class ManagedAgentVersions {
  private records: Record[] = [];
  private error: Error | undefined;
  private readonly manifest: string;
  private readonly directory: string;

  constructor(
    baseDir: string,
    capabilities: readonly Capability[],
    private readonly deps: {
      install?: (capability: Capability, version: string, directory: string) => Promise<void>;
    } = {},
  ) {
    this.directory = join(baseDir, "agent-versions");
    this.manifest = join(this.directory, "active.json");
    for (const capability of capabilities) setManagedExecutable(capability.binary, undefined);
    if (process.platform === "win32" || !existsSync(this.manifest)) return;
    try {
      this.records = storeSchema.parse(JSON.parse(readFileSync(this.manifest, "utf8"))).records;
      for (const record of this.records) {
        const capability = capabilities.find(
          (c) => c.npmPackage === record.package && c.binary === record.binary,
        );
        if (!capability)
          throw new Error("Managed installation no longer matches a declared provider capability.");
        const path = this.validatePackage(capability, record.active);
        setManagedExecutable(record.binary, path);
      }
    } catch {
      this.error = new Error(
        "Managed version state is invalid. Its files were preserved; repair is required before launching a managed runtime.",
      );
      for (const capability of capabilities) setManagedExecutable(capability.binary, this.error);
    }
  }

  state(capability: Capability | undefined): AgentVersionsState {
    if (!capability || process.platform === "win32") return { supported: false };
    const record = this.records.find((r) => r.package === capability.npmPackage);
    return {
      supported: true,
      ...(record
        ? { active: record.active, ...(record.previous ? { previous: record.previous } : {}) }
        : {}),
      ...(this.error ? { error: this.error.message } : {}),
    };
  }

  isPinned(capability: Capability | undefined): boolean {
    return Boolean(
      capability && (this.error || this.records.some((r) => r.package === capability.npmPackage)),
    );
  }

  private installDir(capability: Capability, version: string): string {
    return join(
      this.directory,
      createHash("sha256").update(capability.npmPackage).digest("hex"),
      exactAgentVersionSchema.parse(version),
    );
  }

  private validatePackage(capability: Capability, version: string): string {
    const directory = this.installDir(capability, version);
    const packagePath = join(directory, "node_modules", capability.npmPackage, "package.json");
    const pkg = packageSchema.parse(JSON.parse(readFileSync(packagePath, "utf8")));
    if (pkg.name !== capability.npmPackage || pkg.version !== version)
      throw new Error(
        "Installed package identity or version does not match the requested runtime.",
      );
    const root = realpathSync(directory);
    const path = realpathSync(join(directory, "node_modules", ".bin", capability.binary));
    if (relative(root, path).startsWith(`..${sep}`) || !path.startsWith(`${root}${sep}`))
      throw new Error("Managed executable escapes its installation.");
    const lock = lockSchema.parse(
      JSON.parse(readFileSync(join(directory, "package-lock.json"), "utf8")),
    );
    const entry = lock.packages[`node_modules/${capability.npmPackage}`];
    if (entry?.version !== version || !entry.integrity?.startsWith("sha512-"))
      throw new Error("Installed package has no matching integrity lock.");
    return join(directory, "node_modules", ".bin", capability.binary);
  }

  private async verify(capability: Capability, version: string): Promise<string> {
    const path = this.validatePackage(capability, version);
    const actual = extractSemverFromVersionOutput(
      (await execFileAsync(path, ["--version"], { timeout: 15_000, maxBuffer: 64 * 1024 })).stdout,
    );
    if (actual !== version)
      throw new Error("Executable version does not match the installed package.");
    await capability.verifyInstallation(path);
    return path;
  }

  async install(capability: Capability, version: string): Promise<void> {
    if (this.error) throw this.error;
    exactAgentVersionSchema.parse(version);
    const directory = this.installDir(capability, version);
    if (!existsSync(directory)) {
      mkdirSync(dirname(directory), { recursive: true });
      const stage = mkdtempSync(join(dirname(directory), ".install-"));
      try {
        if (this.deps.install) await this.deps.install(capability, version, stage);
        else await this.installPackage(capability, version, stage);
        renameSync(stage, directory);
      } finally {
        rmSync(stage, { recursive: true, force: true });
      }
    }
    // A rejected or interrupted candidate never replaces the current activation.
    const path = await this.verify(capability, version);
    const old = this.records.find((r) => r.package === capability.npmPackage);
    const record = {
      package: capability.npmPackage,
      binary: capability.binary,
      active: version,
      ...(old && old.active !== version
        ? { previous: old.active }
        : old?.previous
          ? { previous: old.previous }
          : {}),
    };
    this.commit([...this.records.filter((r) => r.package !== capability.npmPackage), record]);
    setManagedExecutable(capability.binary, path);
  }

  private async installPackage(
    capability: Capability,
    version: string,
    directory: string,
  ): Promise<void> {
    const registry = "https://registry.npmjs.org";
    const scope = capability.npmPackage.startsWith("@")
      ? capability.npmPackage.split("/")[0]
      : undefined;
    const registryArgs = [
      `--registry=${registry}`,
      ...(scope ? [`--${scope}:registry=${registry}`] : []),
    ];
    const result = await execFileAsync(
      "npm",
      ["view", `${capability.npmPackage}@${version}`, "dist.integrity", "--json", ...registryArgs],
      { timeout: 60_000, maxBuffer: 64 * 1024 },
    );
    const integrity = z.string().startsWith("sha512-").parse(JSON.parse(result.stdout));
    await execFileAsync(
      "npm",
      [
        "install",
        "--prefix",
        directory,
        "--save-exact",
        "--package-lock=true",
        "--no-audit",
        "--no-fund",
        ...registryArgs,
        `${capability.npmPackage}@${version}`,
      ],
      { timeout: 5 * 60_000, maxBuffer: 1024 * 1024 },
    );
    const lock = lockSchema.parse(
      JSON.parse(readFileSync(join(directory, "package-lock.json"), "utf8")),
    );
    if (lock.packages[`node_modules/${capability.npmPackage}`]?.integrity !== integrity)
      throw new Error("Downloaded package integrity does not match its registry metadata.");
  }

  async rollback(capability: Capability): Promise<void> {
    if (this.error) throw this.error;
    const record = this.records.find((r) => r.package === capability.npmPackage);
    const previous = record?.previous;
    if (!record || !previous) throw new Error("No previous managed version is available.");
    const path = await this.verify(capability, previous);
    this.commit(
      this.records.map((r) =>
        r === record ? { ...record, active: previous, previous: record.active } : r,
      ),
    );
    setManagedExecutable(capability.binary, path);
  }

  useSystem(capability: Capability): void {
    if (this.error) throw this.error;
    this.commit(this.records.filter((r) => r.package !== capability.npmPackage));
    setManagedExecutable(capability.binary, undefined);
  }

  private commit(records: Record[]): void {
    writeFileAtomic(
      this.manifest,
      JSON.stringify(storeSchema.parse({ version: STORE_VERSION, records })),
      { encoding: "utf8", mode: 0o600 },
    );
    this.records = records;
  }
}
