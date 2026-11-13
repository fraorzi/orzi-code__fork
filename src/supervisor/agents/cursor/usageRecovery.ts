import type { AgentAdapter } from "../base";

export const usageRecovery = {
  isLimitError: (message) =>
    /usage limit|rate[_ ]limit|quota (?:exhausted|exceeded)/i.test(message),
  windowIds: (config) => (config.model === "auto" ? ["cursor-auto"] : ["cursor-api"]),
} satisfies NonNullable<AgentAdapter["usageRecovery"]>;
