import type { SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk";
import type { TaskTokenUsage } from "@/shared/contracts";
import { readNonNegativeInteger } from "../contextUsage";
import { readClaudeAssistantUsageSampleId } from "./canonicalMapping/usageSpent";

type CallTokens = Pick<
  TaskTokenUsage,
  "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens"
>;

/** Multiple content blocks and replays share an API call id. Replace, never sum, those samples. */
export class ClaudeTaskUsageTracker {
  private samples = new Map<string, CallTokens>();
  private usage: TaskTokenUsage | undefined;

  begin(turnId: string): TaskTokenUsage {
    this.samples.clear();
    this.usage = {
      turnId,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    return { ...this.usage };
  }

  setContextBaseline(turnId: string, tokens: number): void {
    if (this.usage?.turnId === turnId) this.usage.contextTokensAtStart = tokens;
  }

  snapshot(): TaskTokenUsage | undefined {
    return this.usage ? { ...this.usage } : undefined;
  }

  record(message: SDKAssistantMessage): TaskTokenUsage | undefined {
    if (!this.usage) return undefined;
    const native = message.message?.usage;
    if (!native || typeof native !== "object") return undefined;
    const values = {
      inputTokens: readNonNegativeInteger(native.input_tokens),
      outputTokens: readNonNegativeInteger(native.output_tokens),
      cacheReadTokens: readNonNegativeInteger(native.cache_read_input_tokens),
      cacheWriteTokens: readNonNegativeInteger(native.cache_creation_input_tokens),
    };
    if (Object.values(values).every((value) => value === undefined)) return undefined;
    const sampleId = readClaudeAssistantUsageSampleId(message);
    const previous = this.samples.get(sampleId);
    const sample: CallTokens = {
      inputTokens: Math.max(previous?.inputTokens ?? 0, values.inputTokens ?? 0),
      outputTokens: Math.max(previous?.outputTokens ?? 0, values.outputTokens ?? 0),
      cacheReadTokens: Math.max(previous?.cacheReadTokens ?? 0, values.cacheReadTokens ?? 0),
      cacheWriteTokens: Math.max(previous?.cacheWriteTokens ?? 0, values.cacheWriteTokens ?? 0),
    };
    if (
      previous &&
      sample.inputTokens === previous.inputTokens &&
      sample.outputTokens === previous.outputTokens &&
      sample.cacheReadTokens === previous.cacheReadTokens &&
      sample.cacheWriteTokens === previous.cacheWriteTokens
    )
      return undefined;
    if (!previous) this.usage.calls += 1;
    for (const key of [
      "inputTokens",
      "outputTokens",
      "cacheReadTokens",
      "cacheWriteTokens",
    ] as const) {
      this.usage[key] += sample[key] - (previous?.[key] ?? 0);
    }
    this.samples.set(sampleId, sample);
    return this.snapshot();
  }
}
