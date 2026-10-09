import type { ToolSpec, McpToolResult } from "./types";
import type { SubagentRunManager } from "./SubagentRunManager";
import { errorResult, jsonResult } from "./toolResult";

export const TEAM_TOOLS: ToolSpec[] = [
  {
    name: "list_team_workspaces",
    description:
      "List this thread's saved team tasks, including interrupted work and pending integrations after an app restart.",
    inputSchema: { type: "object", properties: {} },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  ...["resume_team_run", "recover_team_integration", "remove_team_workspace"].map((name) => ({
    name,
    description:
      name === "resume_team_run"
        ? "Continue an interrupted team task in its retained worktree. Returns a run_id; use wait_for_agent to collect the result."
        : name === "recover_team_integration"
          ? "Finish a completed worker's pending integration without replaying its task."
          : "Remove an inactive saved team worktree and its snapshot reference. Unintegrated work requires discard_changes=true and explicit user authorization to discard it.",
    inputSchema: {
      type: "object",
      required: ["run_id"],
      properties: {
        run_id: { type: "string", pattern: "^[a-f0-9]{12}$" },
        ...(name === "remove_team_workspace"
          ? { discard_changes: { type: "boolean", default: false } }
          : {}),
      },
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: name !== "resume_team_run",
      openWorldHint: name === "resume_team_run",
    },
  })),
];

export async function dispatchTeamTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { parentThreadId: string; runManager: SubagentRunManager },
): Promise<McpToolResult | undefined> {
  switch (name) {
    case "list_team_workspaces":
      return jsonResult(await ctx.runManager.listTeamWorkspaces(ctx.parentThreadId));
    case "resume_team_run": {
      if (typeof args.run_id !== "string") return errorResult("run_id is required");
      const result = await ctx.runManager.resumeTeamRun(ctx.parentThreadId, args.run_id);
      return jsonResult({ run_id: result.runId, status: "running" });
    }
    case "recover_team_integration":
      if (typeof args.run_id !== "string") return errorResult("run_id is required");
      return jsonResult(
        await ctx.runManager.recoverTeamIntegration(ctx.parentThreadId, args.run_id),
      );
    case "remove_team_workspace":
      if (typeof args.run_id !== "string") return errorResult("run_id is required");
      await ctx.runManager.removeTeamWorkspace(
        ctx.parentThreadId,
        args.run_id,
        args.discard_changes === true,
      );
      return jsonResult({ status: "removed" });
  }
  return undefined;
}
