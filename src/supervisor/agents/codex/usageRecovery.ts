import type { AgentAdapter } from "../base";

export const usageRecovery = {
  isLimitError: (message) =>
    /usage[_ ]limit[_ ](?:reached|exceeded)|you(?:['’]ve| have) hit your usage limit|rate limit reached/i.test(
      message,
    ),
  windowIds: (config) => [
    "session-5h",
    "weekly",
    `codex:${config.model}:session-5h`,
    `codex:${config.model}:weekly`,
  ],
} satisfies NonNullable<AgentAdapter["usageRecovery"]>;
