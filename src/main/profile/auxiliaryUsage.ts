import type {
  AuxiliaryGenerationMeasurement,
  AuxiliaryOperation,
  AuxiliaryUsageSummary,
} from "@/shared/auxiliaryUsage";
import { getSqlite } from "../db/connection";
import { dbAppendUsageEvents, type UsageEventInput, type UsageEventRow } from "../db/usageEvents";

// Additive v1 row kinds: historical chat rows retain their original meaning.
// No SQL schema change; old readers ignore these kinds, and no backfill can
// honestly recover consumption for historical uninstrumented generations.
const RUN = "auxiliary_run_v1";
const TOKENS = "auxiliary_tokens_v1";
const TOKEN_REPORT = "auxiliary_token_report_v1";
const COST = "auxiliary_cost_usd_v1";
const COST_REPORT = "auxiliary_cost_report_v1";
const DURATION = "auxiliary_duration_ms_v1";

function nonnegative(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

/** Threadless utility activity, replay-safe and atomic with its consumption rows. */
export function recordAuxiliaryGeneration(measurement: AuxiliaryGenerationMeasurement): void {
  const sqlite = getSqlite();
  sqlite.transaction(() => {
    const inserted = sqlite
      .prepare("INSERT OR IGNORE INTO usage_token_samples (sample_id, ts) VALUES (?, ?)")
      .run(`auxiliary:${measurement.id}`, measurement.finishedAt);
    if (inserted.changes !== 1) return;
    const base: UsageEventInput = {
      ts: measurement.finishedAt,
      kind: RUN,
      provider: measurement.provider,
      model: measurement.model,
      effort: measurement.effort,
      name: measurement.operation,
      mode: measurement.outcome,
    };
    const rows: UsageEventInput[] = [{ ...base, value: 1 }];
    const duration = measurement.finishedAt - measurement.startedAt;
    if (nonnegative(duration)) rows.push({ ...base, kind: DURATION, value: duration });
    let hasTokenReport = false;
    let hasCostReport = false;
    for (const usage of measurement.usage) {
      if (nonnegative(usage.totalTokens) && Number.isSafeInteger(usage.totalTokens)) {
        rows.push({
          ...base,
          kind: TOKENS,
          model: usage.model ?? base.model,
          value: usage.totalTokens,
        });
        hasTokenReport = true;
      }
      if (nonnegative(usage.costUsd)) {
        hasCostReport = true;
        rows.push({ ...base, kind: COST, model: usage.model ?? base.model, value: usage.costUsd });
      }
    }
    if (hasTokenReport) rows.push({ ...base, kind: TOKEN_REPORT, value: 1 });
    if (hasCostReport) rows.push({ ...base, kind: COST_REPORT, value: 1 });
    dbAppendUsageEvents(rows);
  })();
}

function operation(value: string | null): AuxiliaryOperation | undefined {
  return value === "title" || value === "commit" || value === "pr" ? value : undefined;
}

/** Caller filters account and calendar range exactly as for the rest of Profile. */
export function summarizeAuxiliaryUsage(rows: readonly UsageEventRow[]): AuxiliaryUsageSummary[] {
  const summaries = new Map<AuxiliaryOperation, AuxiliaryUsageSummary>();
  for (const row of rows) {
    if (
      row.kind !== RUN &&
      row.kind !== TOKENS &&
      row.kind !== TOKEN_REPORT &&
      row.kind !== COST &&
      row.kind !== COST_REPORT
    )
      continue;
    const name = operation(row.name);
    if (!name || !nonnegative(row.value)) continue;
    let summary = summaries.get(name);
    if (!summary) {
      summary = {
        operation: name,
        runs: 0,
        failedRuns: 0,
        runsWithTokenReports: 0,
        runsWithCostReports: 0,
      };
      summaries.set(name, summary);
    }
    if (row.kind === RUN) {
      summary.runs += row.value;
      if (row.mode === "failed") summary.failedRuns += row.value;
    } else if (row.kind === TOKEN_REPORT) {
      summary.runsWithTokenReports += row.value;
    } else if (row.kind === COST_REPORT) {
      summary.runsWithCostReports += row.value;
    } else if (row.kind === COST) {
      summary.reportedCostUsd = (summary.reportedCostUsd ?? 0) + row.value;
    } else {
      summary.reportedTokens = (summary.reportedTokens ?? 0) + row.value;
    }
  }
  return [...summaries.values()].sort((a, b) => a.operation.localeCompare(b.operation));
}
