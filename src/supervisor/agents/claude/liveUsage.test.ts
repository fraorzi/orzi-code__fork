import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SupervisorEvent } from "@/shared/ipc";
import { UsageService } from "../../runtime/usageService";
import { normalizeClaudeLiveUsage } from "./liveUsage";

function event(rate_limit_info: unknown) {
  return { type: "rate_limit_event", rate_limit_info };
}

describe("Claude live subscription limits", () => {
  it("immediately publishes exhaustion while retaining the account and other cached windows", () => {
    const directory = mkdtempSync(join(tmpdir(), "claude-live-usage-"));
    const events: SupervisorEvent[] = [];
    const service = new UsageService({
      cachePath: join(directory, "usage.json"),
      emit: (value) => events.push(value),
      localCollectors: [],
    });
    try {
      service.acceptLiveSnapshot({
        providerId: "claude",
        status: "ok",
        plan: "Claude Max Subscription",
        fetchedAt: 122,
        windows: [
          { id: "session-5h", label: "Session (5h)", unit: "percent", usedPercent: 97 },
          { id: "weekly", label: "Weekly", unit: "percent", usedPercent: 43 },
        ],
      });
      const snapshot = normalizeClaudeLiveUsage(
        event({ status: "rejected", rateLimitType: "five_hour", resetsAt: 1_800_000_000 }),
        123,
      );
      if (!snapshot) throw new Error("Expected a live usage snapshot");
      service.acceptLiveSnapshot(snapshot);
      expect(events.at(-1)).toEqual({
        type: "provider-usage",
        snapshot: {
          providerId: "claude",
          status: "ok",
          plan: "Claude Max Subscription",
          fetchedAt: 123,
          windows: [
            {
              id: "session-5h",
              label: "Session (5h)",
              unit: "percent",
              usedPercent: 100,
              resetsAt: 1_800_000_000_000,
            },
            { id: "weekly", label: "Weekly", unit: "percent", usedPercent: 43 },
          ],
        },
      });
    } finally {
      service.stop();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reads all available buckets even when the allowed event omits top-level utilization", () => {
    expect(
      normalizeClaudeLiveUsage(
        event({
          status: "allowed",
          rateLimitType: "five_hour",
          unifiedWindows: {
            five_hour: { utilization: 0.24, resetsAt: 1_800_000_000 },
            seven_day: { utilization: 0.13 },
            seven_day_opus: { utilization: 0.5 },
            seven_day_sonnet: { utilization: 0 },
            unknown: { utilization: 0.99 },
          },
        }),
        123,
      ),
    ).toEqual({
      providerId: "claude",
      status: "ok",
      fetchedAt: 123,
      windows: [
        {
          id: "session-5h",
          label: "Session (5h)",
          unit: "percent",
          usedPercent: 24,
          resetsAt: 1_800_000_000_000,
        },
        { id: "weekly", label: "Weekly", unit: "percent", usedPercent: 13 },
        { id: "weekly-opus", label: "Weekly (Opus)", unit: "percent", usedPercent: 50 },
        { id: "weekly-sonnet", label: "Weekly (Sonnet)", unit: "percent", usedPercent: 0 },
      ],
    });
  });

  it.each([undefined, 0.98, 1.1])("shows a rejected bucket as exhausted: %s", (utilization) => {
    const result = normalizeClaudeLiveUsage(
      event({
        status: "rejected",
        rateLimitType: "seven_day",
        ...(utilization !== undefined ? { utilization } : {}),
        resetsAt: 1_800_000_000,
        unifiedWindows: { five_hour: { utilization: 0.45 } },
      }),
      123,
    );
    expect(result?.windows).toEqual([
      { id: "session-5h", label: "Session (5h)", unit: "percent", usedPercent: 45 },
      {
        id: "weekly",
        label: "Weekly",
        unit: "percent",
        usedPercent: 100,
        resetsAt: 1_800_000_000_000,
      },
    ]);
  });

  it("prefers the current warning over its older bucket and clamps fractional utilization", () => {
    expect(
      normalizeClaudeLiveUsage(
        event({
          status: "allowed_warning",
          rateLimitType: "five_hour",
          utilization: 1.01,
          resetsAt: 1_800_000_001,
          unifiedWindows: { five_hour: { utilization: 0.9, resetsAt: 1_800_000_000 } },
        }),
        123,
      )?.windows,
    ).toEqual([
      {
        id: "session-5h",
        label: "Session (5h)",
        unit: "percent",
        usedPercent: 100,
        resetsAt: 1_800_000_001_000,
      },
    ]);
  });

  it.each([
    null,
    { type: "assistant" },
    event({ status: "allowed", rateLimitType: "five_hour" }),
    event({ status: "rejected", rateLimitType: "overage" }),
    event({ status: "allowed_warning", rateLimitType: "five_hour", utilization: "0.9" }),
    event({ status: "allowed_warning", rateLimitType: "five_hour", utilization: -1 }),
    event({ status: "allowed_warning", rateLimitType: "five_hour", utilization: NaN }),
    event({ status: "allowed_warning", rateLimitType: "five_hour", utilization: Infinity }),
    event({ status: "allowed", unifiedWindows: { five_hour: { utilization: "0.4" } } }),
  ])(
    "ignores missing, unsupported or invalid usage without inventing a percentage: %j",
    (payload) => {
      expect(normalizeClaudeLiveUsage(payload, 123)).toBeUndefined();
    },
  );

  it("retains valid buckets when a sibling is malformed", () => {
    expect(
      normalizeClaudeLiveUsage(
        event({
          status: "allowed",
          unifiedWindows: {
            five_hour: { utilization: "unknown" },
            seven_day: { utilization: 0.01 },
          },
        }),
        123,
      )?.windows,
    ).toEqual([{ id: "weekly", label: "Weekly", unit: "percent", usedPercent: 1 }]);
  });
});
