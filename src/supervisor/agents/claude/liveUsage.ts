import { z } from "zod";
import type { UsageSnapshot, UsageWindow } from "@poracode/agents-usage";

const windowSchema = z.object({
  utilization: z.number().finite().nonnegative().optional(),
  resetsAt: z.number().int().positive().optional(),
});
const eventSchema = z.object({
  type: z.literal("rate_limit_event"),
  rate_limit_info: windowSchema.extend({
    status: z.enum(["allowed", "allowed_warning", "rejected"]),
    rateLimitType: z.string().optional(),
    // Present on newer CLIs before being declared in the SDK types. Parse at
    // the provider boundary; unknown or malformed buckets cannot invent usage.
    unifiedWindows: z.record(z.string(), z.unknown()).optional(),
  }),
});

/** SDK utilization is a fraction, unlike the OAuth usage endpoint's percent. */
export function normalizeClaudeLiveUsage(payload: unknown, now: number): UsageSnapshot | undefined {
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) return undefined;
  const info = parsed.data.rate_limit_info;
  const windows: UsageWindow[] = [];
  for (const [type, id, label] of [
    ["five_hour", "session-5h", "Session (5h)"],
    ["seven_day", "weekly", "Weekly"],
    ["seven_day_opus", "weekly-opus", "Weekly (Opus)"],
    ["seven_day_sonnet", "weekly-sonnet", "Weekly (Sonnet)"],
  ] as const) {
    const bucket = windowSchema.safeParse(info.unifiedWindows?.[type]);
    const usage = bucket.success ? bucket.data : undefined;
    const current = type === info.rateLimitType;
    const utilization = (current ? info.utilization : undefined) ?? usage?.utilization;
    const usedPercent =
      current && info.status === "rejected"
        ? 100
        : utilization === undefined
          ? undefined
          : Math.min(100, utilization * 100);
    if (usedPercent === undefined) continue;
    const resetsAt = (current ? info.resetsAt : undefined) ?? usage?.resetsAt;
    windows.push({
      id,
      label,
      unit: "percent",
      usedPercent,
      ...(resetsAt !== undefined ? { resetsAt: resetsAt * 1000 } : {}),
    });
  }
  if (!windows.length) return undefined;
  return { providerId: "claude", status: "ok", windows, fetchedAt: now };
}
