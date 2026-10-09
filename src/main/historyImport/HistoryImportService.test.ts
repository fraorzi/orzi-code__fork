import Database from "better-sqlite3";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePoracodePaths } from "@/shared/poracodePaths";
import {
  closeDatabase,
  getSqlite,
  initDatabase,
  resolveBetterSqliteNativeBindingOptions,
} from "../db/connection";
import { dbGetProjects, dbGetThreads } from "../db/projectsThreads";
import { dbSyncAll } from "../db/sync";
import { HistoryImportService } from "./HistoryImportService";

let directory: string;
let sourcePath: string;
let importer: HistoryImportService;
let source: InstanceType<typeof Database>;
let originalProjects: ReturnType<typeof dbGetProjects>;
let originalThreads: ReturnType<typeof dbGetThreads>;
const date = "2020-01-01T00:00:00.000Z";
function project(database: InstanceType<typeof Database>, id: string, path: string) {
  database
    .prepare(
      "INSERT INTO projects (id, name, location_kind, location_path, created_at) VALUES (?, ?, 'posix', ?, ?)",
    )
    .run(id, id, path, date);
}
function thread(
  database: InstanceType<typeof Database>,
  id: string,
  projectId: string,
  title = id,
) {
  database
    .prepare(
      "INSERT INTO threads (id, project_id, title, agent_kind, config, status, attention, archived, created_at, updated_at, presentation_mode) VALUES (?, ?, ?, 'codex', ?, 'working', 'working', 1, ?, ?, 'gui')",
    )
    .run(id, projectId, title, '{"model":"reasoning"}', date, date);
}
function item(database: InstanceType<typeof Database>, id: string, payload: unknown) {
  database
    .prepare(
      "INSERT INTO thread_runtime_items (thread_id, item_id, position, type, state, payload, streams) VALUES (?, 'message', 0, 'user_message', 'completed', ?, ?)",
    )
    .run(id, JSON.stringify(payload), '{"text":"archival prompt"}');
}

beforeEach(async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  directory = await mkdtemp(resolve(".tmp/history-import-test-"));
  sourcePath = join(directory, "source", "state.sqlite");
  await mkdir(dirname(sourcePath));
  source = initDatabase(sourcePath);
  project(source, "source-shared", "/same-folder");
  project(source, "new-project", "/new-folder");
  thread(source, "shared-thread", "source-shared", "Source must not overwrite this");
  thread(source, "new-thread", "source-shared");
  thread(source, "second-thread", "new-project");
  item(source, "new-thread", { text: "archival prompt" });
  source
    .prepare(
      "INSERT INTO app_state (key, value) VALUES ('source-account-settings', 'private-account')",
    )
    .run();
  source
    .prepare("UPDATE projects SET mcp_servers = ? WHERE id = 'new-project'")
    .run('[{"name":"private","env":{"SECRET":"do-not-import"}}]');
  closeDatabase();
  const paths = resolvePoracodePaths(join(directory, "target"));
  await mkdir(paths.baseDir);
  const target = initDatabase(paths.dbPath);
  project(target, "target-shared", "/same-folder");
  thread(target, "shared-thread", "target-shared", "Keep local title");
  item(target, "shared-thread", { text: "keep local history" });
  originalProjects = dbGetProjects();
  originalThreads = dbGetThreads();
  importer = new HistoryImportService({ database: getSqlite, paths: () => paths, flush: () => {} });
  source = new Database(sourcePath, resolveBetterSqliteNativeBindingOptions());
});
afterEach(async () => {
  closeDatabase();
  if (source.open) source.close();
  await rm(directory, { recursive: true, force: true });
});

describe("reviewed additive history import", () => {
  it.each([
    "UPDATE thread_runtime_items SET streams = '{\"text\":42}'",
    "UPDATE threads SET thread_status_source = 'invalid' WHERE id = 'new-thread'",
    "INSERT INTO thread_context_usage VALUES ('new-thread', '{\"usedTokens\":-1}')",
    "INSERT INTO project_notes VALUES ('new-project', NULL, '[{}]', '2020')",
  ])("rejects malformed serialized history before review: %s", async (mutation) => {
    source.exec(mutation);
    expect(await importer.prepare(sourcePath)).toEqual({
      ok: false,
      reason: "unsupportedDatabase",
    });
    expect(dbGetProjects()).toEqual(originalProjects);
    expect(dbGetThreads()).toEqual(originalThreads);
  });
  it("previews and merges history idempotently, preserving local rows and original archive dates", async () => {
    const before = await readFile(sourcePath);
    const prepared = await importer.prepare(sourcePath);
    expect(prepared).toMatchObject({
      ok: true,
      value: { newProjects: 1, newThreads: 2, skippedThreads: 1, attachments: 0 },
    });
    if (!prepared.ok) throw new Error(prepared.reason);
    const imported = await importer.apply(prepared.value.token);
    expect(imported).toMatchObject({ ok: true, value: { projects: 1, threads: 2 } });
    if (!imported.ok) throw new Error(imported.reason);
    expect(dbGetThreads()).toContainEqual(
      expect.objectContaining({
        id: "new-thread",
        projectId: "target-shared",
        status: "inactive",
        archived: true,
        createdAt: date,
      }),
    );
    expect(dbGetThreads()).toContainEqual(
      expect.objectContaining({ id: "shared-thread", title: "Keep local title" }),
    );
    expect(
      getSqlite()
        .prepare("SELECT payload FROM thread_runtime_items WHERE thread_id = 'shared-thread'")
        .get(),
    ).toEqual({ payload: '{"text":"keep local history"}' });
    expect(
      getSqlite()
        .prepare("SELECT value FROM app_state WHERE key = 'source-account-settings'")
        .get(),
    ).toBeUndefined();
    expect(
      getSqlite().prepare("SELECT mcp_servers FROM projects WHERE id = 'new-project'").get(),
    ).toEqual({ mcp_servers: null });
    const backup = new Database(imported.value.backupPath, {
      ...resolveBetterSqliteNativeBindingOptions(),
      readonly: true,
    });
    expect(backup.prepare("SELECT count(*) AS count FROM threads").get()).toEqual({ count: 1 });
    backup.close();
    expect(await readFile(sourcePath)).toEqual(before);
    expect(await importer.prepare(sourcePath)).toMatchObject({
      ok: true,
      value: { newProjects: 0, newThreads: 0, skippedThreads: 3 },
    });
  });
  it("protects imported projects and transcripts against stale renderer snapshots until acknowledged", async () => {
    const preview = await importer.prepare(sourcePath);
    if (!preview.ok) throw new Error(preview.reason);
    expect((await importer.apply(preview.value.token)).ok).toBe(true);
    dbSyncAll(originalProjects, originalThreads, '{"kind":"home"}');
    dbSyncAll(originalProjects, originalThreads, '{"kind":"home"}');
    expect(dbGetProjects().map((entry) => entry.id)).toContain("new-project");
    expect(dbGetThreads()).toHaveLength(3);
    expect(
      getSqlite()
        .prepare(
          "SELECT count(*) AS count FROM thread_runtime_items WHERE thread_id = 'new-thread'",
        )
        .get(),
    ).toEqual({ count: 1 });
    dbSyncAll(dbGetProjects(), dbGetThreads(), '{"kind":"home"}');
    dbSyncAll(originalProjects, originalThreads, '{"kind":"home"}');
    expect(dbGetProjects()).toHaveLength(1);
    expect(dbGetThreads()).toHaveLength(1);
  });
  it("copies owned attachments at preview time, rewrites URLs and keeps the staged bytes after source changes", async () => {
    const imagePath = join(dirname(sourcePath), "attachments", "new-thread", "photo.png");
    await mkdir(dirname(imagePath), { recursive: true });
    await writeFile(imagePath, "original bytes");
    source
      .prepare("UPDATE thread_runtime_items SET payload = ? WHERE thread_id = 'new-thread'")
      .run(
        JSON.stringify({
          attachments: [
            {
              kind: "image",
              path: imagePath,
              dataUrl: `poracode-local://local${pathToFileURL(imagePath).pathname}`,
            },
          ],
        }),
      );
    const preview = await importer.prepare(sourcePath);
    expect(preview).toMatchObject({ ok: true, value: { attachments: 1 } });
    if (!preview.ok) throw new Error(preview.reason);
    await writeFile(imagePath, "source changed after review");
    expect((await importer.apply(preview.value.token)).ok).toBe(true);
    const row = getSqlite()
      .prepare("SELECT payload FROM thread_runtime_items WHERE thread_id = 'new-thread'")
      .get();
    const payload = JSON.parse(
      typeof row === "object" && row && "payload" in row && typeof row.payload === "string"
        ? row.payload
        : "{}",
    );
    expect(payload.attachments[0].path).toContain(
      join("target", "attachments", "new-thread", "import-"),
    );
    expect(await readFile(payload.attachments[0].path, "utf8")).toBe("original bytes");
    expect(payload.attachments[0].dataUrl).toContain(
      pathToFileURL(payload.attachments[0].path).pathname,
    );
    expect(await readFile(imagePath, "utf8")).toBe("source changed after review");
  });
  it("rejects missing or escaping attachment references, unknown versions and self-import without changing the target", async () => {
    const escaped = join(dirname(sourcePath), "attachments", "external");
    await mkdir(dirname(escaped), { recursive: true });
    await symlink(directory, escaped);
    item(source, "second-thread", {
      attachments: [{ kind: "file", path: join(escaped, "private.txt") }],
    });
    await writeFile(join(directory, "private.txt"), "private");
    expect(await importer.prepare(sourcePath)).toEqual({ ok: false, reason: "missingAttachment" });
    source.prepare("UPDATE app_state SET value = '999' WHERE key = 'schema_version'").run();
    expect(await importer.prepare(sourcePath)).toEqual({
      ok: false,
      reason: "unsupportedDatabase",
    });
    expect(await importer.prepare(getSqlite().name)).toEqual({ ok: false, reason: "sameDatabase" });
    expect(dbGetThreads()).toEqual(originalThreads);
  });
  it("invalidates cancelled and stale previews instead of changing the reviewed selection", async () => {
    const cancelled = await importer.prepare(sourcePath);
    if (!cancelled.ok) throw new Error(cancelled.reason);
    await importer.cancel(cancelled.value.token);
    expect(await importer.apply(cancelled.value.token)).toEqual({
      ok: false,
      reason: "stalePreview",
    });
    const preview = await importer.prepare(sourcePath);
    if (!preview.ok) throw new Error(preview.reason);
    thread(getSqlite(), "new-thread", "target-shared", "Created after preview");
    expect(await importer.apply(preview.value.token)).toEqual({
      ok: false,
      reason: "stalePreview",
    });
    expect(dbGetThreads()).toHaveLength(2);
  });
  it("reads a prior-release v41 database and keeps rollback atomic when target insertion fails", async () => {
    source.prepare("UPDATE app_state SET value = '41' WHERE key = 'schema_version'").run();
    const preview = await importer.prepare(sourcePath);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error(preview.reason);
    getSqlite().exec(
      "CREATE TRIGGER fail_import BEFORE INSERT ON threads WHEN NEW.id = 'second-thread' BEGIN SELECT RAISE(ABORT, 'fixture insertion failure'); END",
    );
    expect(await importer.apply(preview.value.token)).toEqual({
      ok: false,
      reason: "operationFailed",
    });
    expect(dbGetProjects()).toEqual(originalProjects);
    expect(dbGetThreads()).toEqual(originalThreads);
    expect(
      source.prepare("SELECT value FROM app_state WHERE key = 'schema_version'").get(),
    ).toEqual({ value: "41" });
  });
});
