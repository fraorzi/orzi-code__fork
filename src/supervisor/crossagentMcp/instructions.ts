import { MAX_CONCURRENT_CHILDREN_PER_PARENT } from "./SubagentRunManager";
import {
  loadPluginCoreSkillPhrase,
  uniqueCoreSkillForBuiltInMcp,
} from "@/shared/plugins/builtInCoreSkills";
const CROSSAGENTS_CORE_SKILL = uniqueCoreSkillForBuiltInMcp("crossagents");

/** Base routing guidance always included in the MCP `initialize` instructions. */
export const CROSSAGENT_MCP_INSTRUCTIONS_BASE = [
  "Use the Crossagents MCP server to delegate lightweight, ephemeral work to the other AI agents connected to this Poracode session.",
  `If ${CROSSAGENTS_CORE_SKILL} is listed among your available skills, ${loadPluginCoreSkillPhrase(CROSSAGENTS_CORE_SKILL)} for additional guidance. Otherwise follow these server instructions directly. Crossagents works without that optional plugin skill; do not search for or install a missing skill.`,
  "Every tool named below belongs to this server. Hosts that namespace MCP tools expose them under this server's name (for example `crossagents__list_agents` or `mcp__crossagents__list_agents`), so resolve each bare name against your own tool list and call the crossagents entry - never the same bare name under another server such as `poracode`.",
  "Delegate only once the user has explicitly asked you to involve another agent in this thread, for example via an @Crossagents mention or a direct request to delegate or get a second opinion. Enabling Teamwork in the app also counts as this explicit request. That ask authorizes delegation for the rest of the thread, so later turns may spawn as the work requires; until then, never spawn subagents on your own initiative.",
  "Call list_agents when provider selection matters; call get_agent only when you need one provider's detailed models, reasoning options, Fast availability, or permissions preset.",
  "Classify every task with 1-5 concise lowercase tags and pass the same tags to list_agents and spawn_agent. Prefer this vocabulary when applicable: frontend, ui, design, backend, mobile, simulator, implementation, bugfix, review, testing, research, refactor, docs, devops, data. Crossagents learns tag-to-selection affinity from user-explicit selection choices without an extra model call.",
  "Call list_routing_preferences to discover user-defined worker roles, their names, task tags and instructions. To use a role, include all of its tags in list_agents and spawn_agent. A matching role supplies model preferences and prepends its instructions to the worker prompt when that selection is used. Explicit selection fields still win; roles do not change permissions or authorize delegation by themselves.",
  "Explicit provider, model, reasoning, and Fast values always win. When the user does not specify them, omit those fields and Crossagents will resolve matching manual task routes first, then learned task tags, global explicit Crossagents usage, frequently used and favorite composer selections, then built-in order.",
  "When the user explicitly asks to always prefer a provider/model for a kind of task, call set_routing_preference with its tags and selection. This persistent manual override ranks before learned affinity. Use remove_routing_preference when the user asks to forget or reset it; do not create or remove persistent preferences without clear user intent.",
  "This server hosts one delegation lane: ephemeral subagent runs whose output streams into your own thread.",
  "Use spawn_agent for delegation: it waits by default. Set background=true only when the parent has useful work to do before the result; this returns a run_id and never injects a new message into the parent thread. At the next synchronization point, call wait_for_agent for every background result the task requires. Each wait is bounded only to stay below the MCP client's transport timeout: status=running means the server kept the child active, and the elapsed wait does not by itself mean the run stalled. When its result is required, keep waiting across as many wait_for_agent calls as necessary. Never cancel or abandon a run solely because 180 seconds or any other wait duration elapsed, it has not produced a final answer yet, or it is still investigating. Cancel only when the user explicitly asks or the task is no longer needed for a reason unrelated to elapsed time.",
  "wait_for_agent and get_status support incremental output: pass the previous result's total_output_chars as after_output_chars on the next call, so repeated waits return only newer text and identical retries remain safe. Output is clipped to a short tail while the run is still working; clipped text requires full_output=true if genuinely needed.",
  `Pass tasks=[...] to the same spawn_agent call to launch up to ${MAX_CONCURRENT_CHILDREN_PER_PARENT} independent agents in parallel. Each parent thread can have at most ${MAX_CONCURRENT_CHILDREN_PER_PARENT} running agents across all calls; wait for an existing run to finish before spawning beyond that limit.`,
  "Use ordered fallbacks to retry startup failures on another model or provider. Retrying after a dispatched turn requires retry_on='any-failure' because it may repeat side effects.",
  "Background runs also survive interruption of the current parent turn, but still stop when the parent thread closes.",
  "Teamwork tasks and worktrees are saved across app restarts. Call list_team_workspaces to find interrupted tasks. Use resume_team_run to continue in the existing worktree after inspecting its prior work, or recover_team_integration to finish an integration interrupted after the worker completed. Do not blindly repeat external side effects. Cleanup integrated work with remove_team_workspace; discard_changes=true requires the user's explicit request to discard unfinished work.",
  "Give each subagent a self-contained prompt - it does not share your conversation context.",
  "Use steer_agent to send a follow-up message to a running child: corrections, new evidence, or narrowed scope. The child keeps its session and context and continues with your message. It is a message, not a result: keep waiting for the child to finish. list_runs.can_steer is false only while a child is still starting, has finished, or is processing a previous message.",
  "For larger batches, call list_runs with include_capacity=true to inspect available_slots (a snapshot, not a reservation). Use wait_for_agent with run_ids and wait_mode='any' to collect the next completed result and refill free slots; omit already-settled runs from the next wait. Scope concurrent edits to distinct files or clearly separated responsibilities. Include the objective, relevant context, constraints, and acceptance checks in each prompt. Ask for findings with file references, verification evidence, and unresolved risks; validate the returned work before integrating it.",
  "Always set name on spawn_agent and on every tasks=[...] entry: a short, specific label describing what that subagent will do (for example `Review runtime findings`). Users see this label in the thread; do not omit it or repeat provider/model/reasoning values there - Crossagents appends those automatically.",
  "For raster generation or image edits on signed-in accounts, call list_image_providers, then create_image with a new project-relative output_path and optional reference_paths. Collect the file and inline preview with get_image_result. Respect the advertised image model; never silently substitute an unavailable model or use paid API billing.",
  "For long-lived, first-class app threads the user sees in the sidebar (optionally in their own git worktree) - e.g. one ticket or feature per thread - use the always-on `poracode` MCP server's thread tools (create_thread, list_threads, get_thread, read_thread, send_to_thread, wait_for_thread, interrupt_thread, stop_thread) instead.",
].join(" ");

export function buildSubagentInstructions(routingGuide?: string): string {
  const guide = routingGuide?.trim();
  return guide
    ? `${CROSSAGENT_MCP_INSTRUCTIONS_BASE}\n\n${guide}`
    : CROSSAGENT_MCP_INSTRUCTIONS_BASE;
}

export const CROSSAGENT_MCP_DISCOVERY =
  "Crossagents delegates work to connected agents. Only delegate when the user explicitly requested " +
  "delegation or enabled Teamwork. Before using this server, call its read_instructions tool. " +
  "Respect the user's scope and use subscription access only.";
