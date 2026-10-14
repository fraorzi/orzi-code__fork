import type {
  StreamableHttpMcpToolResult,
  StreamableHttpMcpToolSpec,
} from "../../mcp/StreamableHttpMcpIngress";
import { agentTools } from "./tools/agents";
import { appTools } from "./tools/app";
import { fileTools } from "./tools/files";
import { gitTools } from "./tools/git";
import { githubTools } from "./tools/github";
import { mcpServerTools } from "./tools/mcpServers";
import { projectTools } from "./tools/projects";
import { scheduleTools } from "./tools/schedules";
import { searchTools } from "./tools/search";
import { settingsTools } from "./tools/settings";
import { skillTools } from "./tools/skills";
import { threadTools } from "./tools/threads";
import { usageTools } from "./tools/usage";
import { workspaceTools } from "./tools/workspaces";
import type { AppControlsToolContext, ToolDomain, ToolHandler } from "./tools/types";

export { APP_CONTROLS_MCP_SERVER_INFO } from "./tools/serverInfo";
export type {
  AppControlsToolContext,
  AppControlsSupervisorCaller,
  AppControlsAppInfo,
  AppControlsNotifyResult,
  AppControlsSettingsGateway,
  AppControlsUpdateCheck,
} from "./tools/types";

export { APP_CONTROLS_MCP_INSTRUCTIONS } from "./instructions";
import { instructionTools } from "./tools/instructions";

const DOMAINS: readonly ToolDomain[] = [
  instructionTools,
  scheduleTools,
  threadTools,
  projectTools,
  workspaceTools,
  settingsTools,
  usageTools,
  searchTools,
  appTools,
  fileTools,
  agentTools,
  gitTools,
  githubTools,
  mcpServerTools,
  skillTools,
];

export const TOOLS: readonly StreamableHttpMcpToolSpec[] = DOMAINS.flatMap(
  (domain) => domain.specs,
);

const HANDLERS: Record<string, ToolHandler> = Object.fromEntries(
  DOMAINS.flatMap((domain) => Object.entries(domain.handlers)),
);

const TOOL_NAMES = new Set(TOOLS.map((tool) => tool.name));

export function isKnownToolName(name: string): boolean {
  return TOOL_NAMES.has(name);
}

export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AppControlsToolContext,
): Promise<unknown> {
  const handler = HANDLERS[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(args, ctx);
}

export function formatToolResult(_name: string, result: unknown): StreamableHttpMcpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
