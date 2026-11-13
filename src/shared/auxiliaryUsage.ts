/** Provider-reported one-shot consumption. Missing metrics stay unknown, never estimated. */
export interface OneShotUsage {
  model?: string;
  totalTokens?: number;
  costUsd?: number;
}

export type AuxiliaryOperation = "title" | "commit" | "pr";

/** One user/app generation request; provider retries can contribute several reports. */
export interface AuxiliaryGenerationMeasurement {
  id: string;
  operation: AuxiliaryOperation;
  provider: string;
  model?: string;
  effort?: string;
  startedAt: number;
  finishedAt: number;
  outcome: "completed" | "failed";
  usage: OneShotUsage[];
}

export interface AuxiliaryUsageSummary {
  operation: AuxiliaryOperation;
  runs: number;
  failedRuns: number;
  runsWithTokenReports: number;
  runsWithCostReports: number;
  /** Provider-reported accounting value, not the user's subscription bill. */
  reportedCostUsd?: number;
  /** Sum of reported consumption only, possibly incomplete when coverage is partial. */
  reportedTokens?: number;
}
