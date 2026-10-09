import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, realpath, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PoracodePaths } from "@/shared/poracodePaths";
import type {
  HistoryImportPreview,
  HistoryImportReport,
  HistoryImportResult,
} from "@/shared/historyImport";
import { resolveBetterSqliteNativeBindingOptions } from "../db/connection";
import { noteMainCreatedProject, noteRecoveredThreads } from "../db/mainCreatedThreads";
import { notifyProjectThreadDataChanged } from "../db/projectThreadChanges";
import {
  copyHistoryRows,
  HistoryImportError,
  normalizeHistoryDatabase,
  planHistoryImport,
  type HistoryImportPlan,
  type ImportDatabase,
} from "./importDatabase";
import { prepareHistoryAttachments, publishHistoryAttachments } from "./importAttachments";

interface PreparedImport {
  preview: HistoryImportPreview;
  directory: string;
  snapshotPath: string;
  plan: HistoryImportPlan;
  attachments: Awaited<ReturnType<typeof prepareHistoryAttachments>>;
}

/** One local review ticket owns an immutable source snapshot and staged attachments. */
export class HistoryImportService {
  private prepared: PreparedImport | undefined;
  private busy = false;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private readonly deps: { database(): ImportDatabase; paths(): PoracodePaths; flush(): void },
  ) {}

  async prepare(sourcePath: string): Promise<HistoryImportResult<HistoryImportPreview>> {
    if (this.busy) return { ok: false, reason: "busy" };
    this.busy = true;
    let directory: string | undefined;
    try {
      await this.clear();
      const paths = this.deps.paths();
      const canonicalSource = await realpath(sourcePath);
      if (canonicalSource === (await realpath(paths.dbPath)))
        throw new HistoryImportError("sameDatabase");
      const token = randomUUID();
      directory = join(paths.cacheDir, "history-import", token);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const snapshotPath = join(directory, "source.sqlite");
      const source = new Database(canonicalSource, {
        ...resolveBetterSqliteNativeBindingOptions(),
        readonly: true,
        fileMustExist: true,
      });
      try {
        await source.backup(snapshotPath);
      } finally {
        source.close();
      }
      await chmod(snapshotPath, 0o600);
      const snapshot = new Database(snapshotPath, resolveBetterSqliteNativeBindingOptions());
      let plan: HistoryImportPlan;
      let attachments: PreparedImport["attachments"];
      try {
        snapshot.pragma("foreign_keys = ON");
        normalizeHistoryDatabase(snapshot);
        plan = planHistoryImport(snapshot, this.deps.database());
        attachments = await prepareHistoryAttachments(
          snapshot,
          plan,
          join(dirname(canonicalSource), "attachments"),
          paths.attachmentsDir,
          join(directory, "attachments"),
          token,
        );
      } finally {
        snapshot.close();
      }
      const preview = {
        token,
        sourcePath: canonicalSource,
        newProjects: plan.newProjects.length,
        newThreads: plan.newThreads.length,
        skippedThreads: plan.skippedThreads,
        attachments: attachments.length,
      };
      this.prepared = { preview, directory, snapshotPath, plan, attachments };
      this.expiry = setTimeout(
        () => {
          if (!this.busy) void this.clear().catch(() => {});
        },
        30 * 60 * 1000,
      );
      this.expiry.unref?.();
      return { ok: true, value: preview };
    } catch (error) {
      if (directory) await rm(directory, { recursive: true, force: true });
      return {
        ok: false,
        reason: error instanceof HistoryImportError ? error.reason : "unsupportedDatabase",
      };
    } finally {
      this.busy = false;
    }
  }

  async apply(token: string): Promise<HistoryImportResult<HistoryImportReport>> {
    if (this.busy) return { ok: false, reason: "busy" };
    const prepared = this.prepared;
    if (!prepared || token !== prepared.preview.token) return { ok: false, reason: "stalePreview" };
    this.busy = true;
    let copiedAttachments = false;
    let committed: HistoryImportReport | undefined;
    try {
      const database = this.deps.database();
      const snapshot = new Database(prepared.snapshotPath, {
        ...resolveBetterSqliteNativeBindingOptions(),
        readonly: true,
        fileMustExist: true,
      });
      const samePlan = () => {
        const current = planHistoryImport(snapshot, database);
        if (
          JSON.stringify([current.newProjects, current.newThreads, [...current.projectIds]]) !==
          JSON.stringify([
            prepared.plan.newProjects,
            prepared.plan.newThreads,
            [...prepared.plan.projectIds],
          ])
        )
          throw new HistoryImportError("stalePreview");
      };
      const backupPath = join(
        this.deps.paths().baseDir,
        "history-import-backups",
        `${Date.now()}-${token}`,
        "state.sqlite",
      );
      try {
        samePlan();
        this.deps.flush();
        await mkdir(dirname(backupPath), { recursive: true, mode: 0o700 });
        await database.backup(backupPath);
        await chmod(backupPath, 0o600);
        copiedAttachments = true;
        await publishHistoryAttachments(prepared.attachments);
        database.transaction(() => {
          samePlan();
          copyHistoryRows(snapshot, database, prepared.plan);
        })();
        committed = {
          projects: prepared.plan.newProjects.length,
          threads: prepared.plan.newThreads.length,
          attachments: prepared.attachments.length,
          backupPath,
        };
      } finally {
        snapshot.close();
      }
      for (const id of prepared.plan.newProjects) noteMainCreatedProject(id);
      noteRecoveredThreads(prepared.plan.newThreads);
      notifyProjectThreadDataChanged();
      await this.clear();
      return { ok: true, value: committed };
    } catch (error) {
      if (copiedAttachments && !committed) {
        for (const directory of new Set(prepared.attachments.map((copy) => dirname(copy.target))))
          await rm(directory, { recursive: true, force: true });
      }
      // A staging cleanup failure must never report a committed import as a
      // failed database transaction that the user might repeat.
      if (committed) return { ok: true, value: committed };
      return {
        ok: false,
        reason: error instanceof HistoryImportError ? error.reason : "operationFailed",
      };
    } finally {
      this.busy = false;
    }
  }

  async cancel(token: string): Promise<void> {
    if (!this.busy && this.prepared?.preview.token === token) await this.clear();
  }
  private async clear(): Promise<void> {
    if (this.expiry) clearTimeout(this.expiry);
    const prepared = this.prepared;
    this.prepared = undefined;
    if (prepared) await rm(prepared.directory, { recursive: true, force: true });
  }
}
