import Database from "better-sqlite3";
import { z } from "zod";
import { projectSchema, threadSchema, type Project } from "@/shared/contracts";
import { projectIdentityKey } from "@/shared/projectIdentity";
import { validateHistoryRecords } from "./validateHistoryRecords";
import {
  assertRequiredDatabaseSchema,
  LATEST_SCHEMA_VERSION,
  runDatabaseMigrations,
} from "../db/migrations";
import type { HistoryImportFailure } from "@/shared/historyImport";

export class HistoryImportError extends Error {
  constructor(readonly reason: HistoryImportFailure) {
    super(reason);
  }
}
export type ImportDatabase = InstanceType<typeof Database>;
const sqlRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));
export type ImportRow = z.infer<typeof sqlRowSchema>;
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const tableSchema = z.enum([
  "projects",
  "threads",
  "thread_runtime_items",
  "thread_runtime_item_stream_chunks",
  "thread_runtime_item_stream_state",
  "thread_completed_turns",
  "thread_context_usage",
  "project_notes",
]);
export const HISTORY_TABLES = tableSchema.options;
export type HistoryTable = z.infer<typeof tableSchema>;

export function* historyRows(database: ImportDatabase, table: HistoryTable): Generator<ImportRow> {
  for (const row of database.prepare(`SELECT * FROM "${tableSchema.parse(table)}"`).iterate())
    yield sqlRowSchema.parse(row);
}

export function importProject(row: ImportRow): Project {
  return projectSchema.parse({
    id: idSchema.parse(row.id),
    name: row.name,
    createdAt: row.created_at,
    ...(row.icon ? { icon: row.icon } : {}),
    ...(typeof row.search_settings === "string"
      ? { searchSettings: JSON.parse(row.search_settings) }
      : {}),
    ...(typeof row.worktree_location === "string"
      ? { worktreeLocation: JSON.parse(row.worktree_location) }
      : {}),
    location:
      row.location_kind === "wsl"
        ? {
            kind: "wsl",
            distro: row.location_distro,
            linuxPath: row.location_linux_path,
            uncPath: row.location_unc_path,
          }
        : { kind: row.location_kind, path: row.location_path },
  });
}

export function normalizeHistoryDatabase(database: ImportDatabase): void {
  const version = z.coerce
    .number()
    .int()
    .parse(
      sqlRowSchema.parse(
        database.prepare("SELECT value FROM app_state WHERE key = 'schema_version'").get(),
      ).value,
    );
  // v41 and v42 have the same history tables. Earlier migrations need a full
  // startup initializer and are deliberately not guessed by this importer.
  if (version < 41 || version > LATEST_SCHEMA_VERSION)
    throw new HistoryImportError("unsupportedDatabase");
  assertRequiredDatabaseSchema(database);
  if (
    database.pragma("quick_check", { simple: true }) !== "ok" ||
    z.array(z.unknown()).parse(database.pragma("foreign_key_check")).length > 0
  )
    throw new HistoryImportError("unsupportedDatabase");
  runDatabaseMigrations(database, version);
  database.exec(
    "UPDATE projects SET last_draft_config = NULL, scripts = NULL, mcp_servers = NULL, gh_account = NULL, workspace_id = NULL; UPDATE threads SET status = 'inactive', attention = 'none', active_turn_started_at = NULL, terminal_prompt = NULL, workspace_id = NULL",
  );
  for (const row of historyRows(database, "projects")) importProject(row);
  for (const row of historyRows(database, "threads")) {
    const optionalJson = (value: unknown) =>
      typeof value === "string" ? JSON.parse(value) : undefined;
    threadSchema.parse({
      id: idSchema.parse(row.id),
      projectId: idSchema.parse(row.project_id),
      title: row.title,
      agentKind: row.agent_kind,
      agentInstanceId: row.agent_instance_id ?? undefined,
      config: optionalJson(row.config),
      sessionRef: optionalJson(row.session_ref),
      status: "inactive",
      attention: "none",
      canResumeWithConfig: row.can_resume_with_config === 1,
      worktreePath: row.worktree_path ?? undefined,
      worktreeBranch: row.worktree_branch ?? undefined,
      prNumber: row.pr_number ?? undefined,
      groupId: row.group_id ?? undefined,
      groupName: row.group_name ?? undefined,
      parentThreadId: row.parent_thread_id ?? undefined,
      threadStatusSource: row.thread_status_source ?? undefined,
      lastTurnStartedAt: row.last_turn_started_at ?? undefined,
      lastTurnEndedAt: row.last_turn_ended_at ?? undefined,
      archived: row.archived === 1,
      archivedAt: row.archived_at ?? undefined,
      done: row.done === 1,
      doneAt: row.done_at ?? undefined,
      starred: row.starred === 1,
      presentationMode: row.presentation_mode ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  validateHistoryRecords(database);
}

export function planHistoryImport(source: ImportDatabase, target: ImportDatabase) {
  const existingProjects = [...historyRows(target, "projects")].map(importProject);
  const identity = (project: Project) =>
    projectIdentityKey(project, { caseInsensitivePosix: process.platform === "darwin" });
  const byIdentity = new Map(existingProjects.map((project) => [identity(project), project.id]));
  const byId = new Map(existingProjects.map((project) => [project.id, project]));
  const projectIds = new Map<string, string>();
  const newProjects: string[] = [];
  for (const row of historyRows(source, "projects")) {
    const project = importProject(row);
    const existing = byId.get(project.id);
    if (existing && identity(existing) !== identity(project))
      throw new HistoryImportError("unsupportedDatabase");
    const mappedId = existing?.id ?? byIdentity.get(identity(project)) ?? project.id;
    projectIds.set(project.id, mappedId);
    if (!byId.has(mappedId)) {
      newProjects.push(project.id);
      byId.set(mappedId, project);
      byIdentity.set(identity(project), mappedId);
    }
  }
  const existingThreads = new Set(
    [...historyRows(target, "threads")].map((row) => idSchema.parse(row.id)),
  );
  const newThreads: string[] = [];
  let skippedThreads = 0;
  for (const row of historyRows(source, "threads")) {
    const id = idSchema.parse(row.id);
    if (existingThreads.has(id)) skippedThreads++;
    else newThreads.push(id);
  }
  return { projectIds, newProjects, newThreads, skippedThreads };
}
export type HistoryImportPlan = ReturnType<typeof planHistoryImport>;

export function copyHistoryRows(
  source: ImportDatabase,
  target: ImportDatabase,
  plan: HistoryImportPlan,
): void {
  const newProjectIds = new Set(plan.newProjects);
  const newThreadIds = new Set(plan.newThreads);
  for (const table of HISTORY_TABLES) {
    const columns = z
      .array(z.object({ name: z.string().regex(/^[a-z_]+$/) }))
      .parse(target.pragma(`table_info("${table}")`))
      .map((column) => column.name);
    const insert = target.prepare(
      `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    );
    for (const row of historyRows(source, table)) {
      const ownerId =
        table === "projects"
          ? row.id
          : table === "threads"
            ? row.id
            : table === "project_notes"
              ? row.project_id
              : row.thread_id;
      if (
        typeof ownerId !== "string" ||
        !(table === "projects" || table === "project_notes" ? newProjectIds : newThreadIds).has(
          ownerId,
        )
      )
        continue;
      if (table === "threads" || table === "project_notes") {
        const mappedProject =
          typeof row.project_id === "string" && plan.projectIds.get(row.project_id);
        if (!mappedProject) throw new HistoryImportError("unsupportedDatabase");
        row.project_id = mappedProject;
      }
      insert.run(...columns.map((column) => row[column] ?? null));
    }
  }
  if (z.array(z.unknown()).parse(target.pragma("foreign_key_check")).length > 0)
    throw new HistoryImportError("unsupportedDatabase");
}
