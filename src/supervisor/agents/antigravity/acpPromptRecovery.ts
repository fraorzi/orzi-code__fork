import type { AcpPromptFailureClassifier } from "../acp/promptRecovery";

// The server emits this diagnostic as assistant text and resolves end_turn,
// even though the generator rejected the trajectory before executing the prompt.
const EMPTY_TRAJECTORY_ERROR = "Agent execution error: trajectory converted to zero chat messages";
const MCP_INITIALIZATION_ERROR_PREFIX = "The MCP server '";
const MCP_INITIALIZATION_ERROR_SUFFIX =
  ". Fix the MCP server, or remove it from your configuration and start a new session, to continue.";
const QUOTA_ERROR = "Usage Limit Reached\n\nYou have reached your current quota for this period.";
const QUOTA_RESET_PREFIX = " Your limit will reset ";

/** The installed server emits this quota notice as assistant text with end_turn. */
export function classifyAntigravityQuotaFailure(
  text: string,
): ReturnType<AcpPromptFailureClassifier> {
  const trimmed = text.trim();
  if (trimmed === QUOTA_ERROR) return "fatal";
  if (QUOTA_ERROR.startsWith(trimmed)) return "incomplete";
  if (!trimmed.startsWith(QUOTA_ERROR)) return undefined;
  const reset = trimmed.slice(QUOTA_ERROR.length);
  if (
    /^ Your limit will reset (?:in \d+ (?:days?|hours?|minutes?|seconds?)(?:, \d+ (?:days?|hours?|minutes?|seconds?))?|on [A-Z][a-z]{2} \d{1,2}, \d{4} \d{2}:\d{2} UTC)\.$/.test(
      reset,
    )
  ) {
    return "fatal";
  }
  return QUOTA_RESET_PREFIX.startsWith(reset) || reset.startsWith(QUOTA_RESET_PREFIX)
    ? "incomplete"
    : undefined;
}

export const classifyAntigravityPromptFailure: AcpPromptFailureClassifier = (text) => {
  const trimmed = text.trim();
  if (trimmed === EMPTY_TRAJECTORY_ERROR) return "failure";
  if (EMPTY_TRAJECTORY_ERROR.startsWith(trimmed)) return "incomplete";
  const quotaFailure = classifyAntigravityQuotaFailure(trimmed);
  if (quotaFailure) return quotaFailure;
  if (MCP_INITIALIZATION_ERROR_PREFIX.startsWith(trimmed)) return "incomplete";
  if (!trimmed.startsWith(MCP_INITIALIZATION_ERROR_PREFIX)) return undefined;

  // SDK startup failures also arrive as assistant prose with end_turn. A
  // broken MCP sign-in cannot be fixed by replaying the user's task.
  const serverNameEnd = trimmed.indexOf("'", MCP_INITIALIZATION_ERROR_PREFIX.length);
  if (serverNameEnd === -1) return trimmed.includes("\n") ? undefined : "incomplete";
  if (serverNameEnd === MCP_INITIALIZATION_ERROR_PREFIX.length) return undefined;
  const header = `${trimmed.slice(0, serverNameEnd + 1)} failed to initialize: `;
  if (header.startsWith(trimmed)) return "incomplete";
  if (!trimmed.startsWith(header)) return undefined;
  return trimmed.endsWith(MCP_INITIALIZATION_ERROR_SUFFIX) &&
    trimmed.length > header.length + MCP_INITIALIZATION_ERROR_SUFFIX.length
    ? "fatal"
    : "incomplete";
};
