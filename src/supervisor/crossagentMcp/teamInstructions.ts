import type { ThreadConfig } from "@/shared/contracts";

/** Added through the structured runtime's instruction channel, never the displayed user text. */
export function teamInstructions(config: ThreadConfig): string | undefined {
  if (!config.teamMode || !config.crossagentMcp) return undefined;
  return [
    "The user enabled Teamwork for this thread. This explicitly authorizes Crossagents delegation and automatic integration without asking for approval of each worker's changes.",
    "You are the lead agent: own the plan and architecture and implement the tightly coupled or difficult core yourself. Delegate independent tasks when this improves capability or separates context. Simple work can use a fast model; independent difficult work can use another strong model from any available provider. Discover real available models and respect user routing preferences. Do not switch to a paid API or assume a model exists.",
    "Use Crossagents spawn_agent with self-contained objectives, scope, interfaces and acceptance checks. At most two workers may run at once, with no recursive delegation. Each worker gets a separate Git worktree snapshot including your current uncommitted changes. Ignored files and dependencies are not copied. Worktrees are for edit isolation, not security sandboxes.",
    "Continue your own implementation while background workers run. Collect every required result with wait_for_agent. Successful workers are automatically integrated before their result becomes completed. Inspect the integration field: applied/no_changes needs no further patch application; needs_resolution means integration did not succeed. Use the returned workspace path and patch_path to resolve conflicts yourself in your working tree, preserving concurrent user and lead changes. Do not ask the user to approve ordinary integration or resolve ordinary code conflicts.",
    "Failed and cancelled workers are not automatically integrated. Their worktrees are retained for recovery. A completed child is not proof that the whole task works: review the combined changes, run appropriate checks, fix failures and report unresolved issues honestly. Do not create commits, push or publish unless the user separately authorizes it.",
  ].join(" ");
}
