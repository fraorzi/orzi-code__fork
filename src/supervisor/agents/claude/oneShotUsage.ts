import { z } from "zod";
import type { OneShotUsage } from "@/shared/auxiliaryUsage";

const count = z.number().int().nonnegative();
const cost = z.number().finite().nonnegative();
const modelUsageSchema = z.object({
  inputTokens: count,
  outputTokens: count,
  cacheReadInputTokens: count,
  cacheCreationInputTokens: count,
  costUSD: cost.optional(),
});
const aggregateUsageSchema = z.object({
  input_tokens: count,
  output_tokens: count,
  cache_read_input_tokens: count,
  cache_creation_input_tokens: count,
});
const resultSchema = z.object({
  type: z.literal("result"),
  result: z.string().optional(),
  is_error: z.boolean().optional(),
  errors: z.array(z.string()).optional(),
  usage: z.unknown().optional(),
  modelUsage: z.record(z.string(), z.unknown()).optional(),
  total_cost_usd: cost.optional(),
});

/** Claude CLI --output-format json result. Model and aggregate usage overlap: count once. */
export function parseClaudeOneShotOutput(raw: string): {
  text: string;
  usage?: OneShotUsage[];
  error?: string;
} {
  const envelope = resultSchema.parse(JSON.parse(raw));
  const usage: OneShotUsage[] = [];
  const modelReports = Object.entries(envelope.modelUsage ?? {}).map(([model, report]) => ({
    model,
    parsed: modelUsageSchema.safeParse(report),
  }));
  if (modelReports.length > 0 && modelReports.every((report) => report.parsed.success)) {
    for (const { model, parsed } of modelReports) {
      if (!parsed.success) continue;
      const value = parsed.data;
      usage.push({
        model,
        totalTokens:
          value.inputTokens +
          value.outputTokens +
          value.cacheReadInputTokens +
          value.cacheCreationInputTokens,
        ...(value.costUSD !== undefined ? { costUsd: value.costUSD } : {}),
      });
    }
    if (
      modelReports.some(
        (report) => report.parsed.success && report.parsed.data.costUSD === undefined,
      ) &&
      envelope.total_cost_usd !== undefined
    ) {
      // An aggregate cost overlaps model costs. Keep one authoritative total
      // when any model omits its cost, without attributing it to a guessed model.
      for (const report of usage) delete report.costUsd;
      usage.push({ costUsd: envelope.total_cost_usd });
    }
  } else {
    const aggregate = aggregateUsageSchema.safeParse(envelope.usage);
    if (aggregate.success || envelope.total_cost_usd !== undefined) {
      usage.push({
        ...(aggregate.success
          ? {
              totalTokens:
                aggregate.data.input_tokens +
                aggregate.data.output_tokens +
                aggregate.data.cache_read_input_tokens +
                aggregate.data.cache_creation_input_tokens,
            }
          : {}),
        ...(envelope.total_cost_usd !== undefined ? { costUsd: envelope.total_cost_usd } : {}),
      });
    }
  }
  return {
    text: envelope.result ?? "",
    ...(usage.length > 0 ? { usage } : {}),
    ...(envelope.is_error
      ? { error: envelope.errors?.join("\n") || envelope.result || "Claude one-shot failed" }
      : {}),
  };
}
