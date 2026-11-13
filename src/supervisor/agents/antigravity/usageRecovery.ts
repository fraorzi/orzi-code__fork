import { antigravityPool, antigravityWindowId } from "@poracode/agents-usage";
import type { AgentAdapter } from "../base";
import { classifyAntigravityQuotaFailure } from "./acpPromptRecovery";

export const usageRecovery = {
  isLimitError: (message) =>
    classifyAntigravityQuotaFailure(message) === "fatal" ||
    /individual quota reached|quota (?:exhausted|exceeded)|rate limit exceeded/i.test(message),
  windowIds: (config) => [
    antigravityWindowId(/gemini/i.test(config.model) ? "gemini" : "claude", "session-5h"),
    antigravityWindowId(/gemini/i.test(config.model) ? "gemini" : "claude", "weekly"),
    `antigravity:${antigravityPool(config.model).id}`,
  ],
} satisfies NonNullable<AgentAdapter["usageRecovery"]>;
