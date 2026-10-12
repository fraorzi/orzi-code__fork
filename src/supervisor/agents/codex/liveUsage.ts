import { z } from "zod";
import type { UsageSnapshot, UsageWindow } from "@poracode/agents-usage";
import { formatCodexPlanLabel } from "@poracode/agents-usage";

const windowSchema = z.object({
  usedPercent: z.number().finite().nonnegative(),
  windowDurationMins: z.number().nullable().optional(),
  resetsAt: z.number().nullable().optional(),
});
const notificationSchema = z.object({
  rateLimits: z.object({
    limitId: z.string().nullable().optional(),
    limitName: z.string().nullable().optional(),
    planType: z.string().nullable().optional(),
    primary: windowSchema.nullable().optional(),
    secondary: windowSchema.nullable().optional(),
  }),
});

/** Rolling updates omit unavailable windows; the usage service merges them by id. */
export function normalizeCodexLiveUsage(payload: unknown, now: number): UsageSnapshot | undefined {
  const parsed = notificationSchema.safeParse(payload);
  if (!parsed.success) return undefined;
  const limits = parsed.data.rateLimits;
  const windows: UsageWindow[] = [];
  for (const [window, fallback] of [
    [limits.primary, "session-5h"],
    [limits.secondary, "weekly"],
  ] as const) {
    if (!window) continue;
    const cadence =
      window.windowDurationMins === 10_080
        ? "weekly"
        : window.windowDurationMins === 300
          ? "session-5h"
          : fallback;
    const additional = limits.limitId && limits.limitId !== "codex";
    windows.push({
      id: additional ? `codex:${limits.limitId}:${cadence}` : cadence,
      label: additional
        ? `${limits.limitName ?? limits.limitId} ${cadence === "weekly" ? "weekly" : "5h"}`
        : cadence === "weekly"
          ? "Weekly"
          : "5h session",
      usedPercent: Math.min(100, window.usedPercent),
      unit: "percent",
      ...(window.resetsAt != null ? { resetsAt: window.resetsAt * 1000 } : {}),
    });
  }
  if (!windows.length) return undefined;
  const plan = formatCodexPlanLabel(limits.planType ?? undefined);
  return { providerId: "codex", status: "ok", windows, fetchedAt: now, ...(plan ? { plan } : {}) };
}
