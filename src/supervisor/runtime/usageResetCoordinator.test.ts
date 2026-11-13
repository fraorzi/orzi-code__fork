import { describe, expect, it, vi } from "vitest";
import type { UsageResetResult } from "@poracode/agents-usage";
import { UsageResetCoordinator } from "./usageResetCoordinator";

const request = {
  providerId: "test",
  grantId: "bonus",
  requestId: "11111111-1111-4111-8111-111111111111",
};

describe("native usage reset coordination", () => {
  it("coalesces an identical request and refuses a different concurrent redemption", async () => {
    let complete: ((result: UsageResetResult) => void) | undefined;
    const consume = vi.fn<() => Promise<UsageResetResult>>(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const refresh = vi.fn<() => Promise<undefined>>(async () => undefined);
    const coordinator = new UsageResetCoordinator({ consume, refresh });
    const first = coordinator.consume(request);
    expect(coordinator.consume(request)).toBe(first);
    expect(await coordinator.consume({ ...request, grantId: "another" })).toEqual({
      outcome: "busy",
    });
    expect(refresh).not.toHaveBeenCalled();
    complete?.({ outcome: "reset" });
    expect(await first).toEqual({ outcome: "reset" });
    expect(consume).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith("test");
  });
  it("preserves a confirmed outcome when the subsequent read fails", async () => {
    const coordinator = new UsageResetCoordinator({
      consume: async () => ({ outcome: "reset" }),
      refresh: async () => {
        throw new Error("offline");
      },
    });
    expect(await coordinator.consume(request)).toEqual({ outcome: "reset" });
  });
  it("returns an unconfirmed result without retrying a failed mutation", async () => {
    const consume = vi.fn<() => Promise<UsageResetResult>>(async () => {
      throw new Error("lost response");
    });
    const coordinator = new UsageResetCoordinator({ consume, refresh: async () => undefined });
    expect(await coordinator.consume(request)).toEqual({ outcome: "unknown" });
    expect(consume).toHaveBeenCalledTimes(1);
  });
  it("reuses an unconfirmed idempotency key even after the renderer recreates its controls", async () => {
    const consume = vi.fn<(payload: typeof request) => Promise<UsageResetResult>>(async () => ({
      outcome: "unknown",
    }));
    const coordinator = new UsageResetCoordinator({ consume, refresh: async () => undefined });
    await coordinator.consume(request);
    await coordinator.consume({ ...request, requestId: "22222222-2222-4222-8222-222222222222" });
    expect(consume.mock.calls.map((call) => call[0].requestId)).toEqual([
      request.requestId,
      request.requestId,
    ]);
  });
});
