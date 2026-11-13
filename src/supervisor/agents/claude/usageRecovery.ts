import type { AgentAdapter } from "../base";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { extractText } from "./canonicalMapping/helpers";

/** The CLI can report quota rejection as a synthetic assistant message before result. */
export function readAssistantLimitError(message: SDKMessage): string | undefined {
  if (message.type !== "assistant" || message.parent_tool_use_id) return;
  if (message.error !== "rate_limit") return;
  return extractText(message.message.content).trim() || "rate_limit_error";
}

export const usageRecovery = {
  isLimitError: (message) =>
    /you(?:['’]ve| have) hit your (?:\d+[- ]hour |weekly |monthly )?limit|usage limit|rate[_ ]limit|quota (?:exhausted|exceeded)/i.test(
      message,
    ),
  windowIds: (config) => [
    "session-5h",
    "weekly",
    ...(/opus/i.test(config.model) ? ["weekly-opus"] : []),
    ...(/sonnet/i.test(config.model) ? ["weekly-sonnet"] : []),
    ...(/fable/i.test(config.model) ? ["weekly-fable"] : []),
  ],
} satisfies NonNullable<AgentAdapter["usageRecovery"]>;
