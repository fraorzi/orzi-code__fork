import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
import { writeFileAtomic } from "@/shared/atomicFile";

const selectionSchema = z.object({
  agent: z.string().min(1),
  model: z.string().optional(),
  effort: z.string().optional(),
  fast: z.boolean().optional(),
});

function selection(value: z.infer<typeof selectionSchema>) {
  return {
    agent: value.agent,
    ...(value.model !== undefined ? { model: value.model } : {}),
    ...(value.effort !== undefined ? { effort: value.effort } : {}),
    ...(value.fast !== undefined ? { fast: value.fast } : {}),
  };
}

// workspace.json remains v1. These additional stores did not exist in older
// releases; missing run metadata means a retained legacy workspace, not a task
// to replay. Unknown or corrupt records are preserved and never overwritten.
export const teamRunSchema = z.object({
  version: z.literal(1),
  parentThreadId: z.string().min(1),
  request: selectionSchema
    .extend({
      prompt: z.string().min(1),
      name: z.string().optional(),
      background: z.boolean().optional(),
      fallbacks: z.array(selectionSchema).max(3).optional(),
      retryMode: z.enum(["startup", "any-failure"]).optional(),
    })
    .transform((value) => ({
      ...selection(value),
      prompt: value.prompt,
      ...(value.name !== undefined ? { name: value.name } : {}),
      ...(value.background !== undefined ? { background: value.background } : {}),
      ...(value.fallbacks !== undefined ? { fallbacks: value.fallbacks.map(selection) } : {}),
      ...(value.retryMode !== undefined ? { retryMode: value.retryMode } : {}),
    })),
  status: z.enum(["running", "completed", "failed", "cancelled"]),
  output: z.string(),
});
export type SavedTeamRun = z.infer<typeof teamRunSchema>;

const workspaceSchema = z.object({
  version: z.literal(1),
  runId: z.string().regex(/^[a-f0-9]{12}$/),
  parentRoot: z.string().min(1),
  root: z.string().min(1),
  projectPath: z.string().min(1),
  baselineTree: z.string().regex(/^[a-f0-9]{40,64}$/),
  baselineRef: z.string().min(1),
  patchPath: z.string().min(1),
});

export const teamIntegrationRecordSchema = z.object({
  version: z.literal(1),
  files: z.array(z.string()),
  state: z.enum(["prepared", "applied", "no_changes"]),
});

export function saveTeamRecord(path: string, value: unknown): void {
  writeFileAtomic(path, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
}

export async function readTeamRecord<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T | undefined> {
  try {
    return schema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

export async function readTeamWorkspace(directory: string, runId: string) {
  if (!/^[a-f0-9]{12}$/.test(runId)) throw new Error("Invalid team run id");
  const workspace = await readTeamRecord(join(directory, runId, "workspace.json"), workspaceSchema);
  if (!workspace) throw new Error("Team workspace not found");
  const projectRelative = relative(workspace.root, workspace.projectPath);
  if (
    workspace.runId !== runId ||
    workspace.root !== resolve(directory, runId, "worktree") ||
    workspace.patchPath !== resolve(directory, runId, "changes.patch") ||
    workspace.baselineRef !== `refs/poracode-team/${runId}/baseline` ||
    !isAbsolute(workspace.parentRoot) ||
    projectRelative === ".." ||
    projectRelative.startsWith("../") ||
    isAbsolute(projectRelative)
  )
    throw new Error("Team workspace identity mismatch");
  return workspace;
}

export async function teamWorkspaceIds(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory)).filter((name) => /^[a-f0-9]{12}$/.test(name));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}
