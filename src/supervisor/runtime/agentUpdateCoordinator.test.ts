import { describe, expect, it, vi } from "vitest";
import { AgentUpdateCoordinator } from "./agentUpdateCoordinator";
import { normalizeSharedSettings } from "@/shared/settings";

function fixture() {
  const update = vi.fn<() => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
  const outdated = vi.fn<() => Promise<boolean>>(async () => true);
  const deps = {
    enabled: vi.fn<() => boolean>(() => true),
    hasSessions: vi.fn<() => boolean>(() => false),
    tasks: async () => [
      { id: "agent", isOutdated: outdated, update: () => coordinator.install(update) },
    ],
    report: vi.fn<(id: string, result: { ok: boolean }) => void>(),
  };
  const coordinator = new AgentUpdateCoordinator(deps);
  return { coordinator, deps, update, outdated };
}

describe("automatic agent updates", () => {
  it("defaults old settings to automatic updates and preserves explicit opt-out", () => {
    expect(normalizeSharedSettings({}).automaticAgentUpdates).toBe(true);
    expect(normalizeSharedSettings({ automaticAgentUpdates: false }).automaticAgentUpdates).toBe(
      false,
    );
  });

  it("updates without a prompt, then observes the six-hour cadence", async () => {
    const { coordinator, update } = fixture();
    await coordinator.sweep(0);
    await coordinator.sweep(60_000);
    expect(update).toHaveBeenCalledTimes(1);
    await coordinator.sweep(6 * 60 * 60_000);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("waits for sessions and retries automatically when they close", async () => {
    const { coordinator, deps, update } = fixture();
    deps.hasSessions.mockReturnValue(true);
    await coordinator.sweep(0);
    expect(update).not.toHaveBeenCalled();
    deps.hasSessions.mockReturnValue(false);
    await coordinator.sweep(60_000);
    expect(update).toHaveBeenCalledOnce();
  });

  it("does not install while a new agent process is starting", async () => {
    const { coordinator, update } = fixture();
    const release = await coordinator.acquireLaunch();
    await coordinator.sweep(0);
    expect(update).not.toHaveBeenCalled();
    release();
    await coordinator.sweep(60_000);
    expect(update).toHaveBeenCalledOnce();
  });

  it("holds new launches until installation finishes and prevents overlapping installers", async () => {
    const { coordinator } = fixture();
    const installation = Promise.withResolvers<{ ok: boolean }>();
    const mutation = coordinator.install(() => installation.promise);
    let launched = false;
    const launch = coordinator.acquireLaunch().then((release) => {
      launched = true;
      release();
    });
    await Promise.resolve();
    expect(launched).toBe(false);
    expect((await coordinator.install(async () => ({ ok: true }))).ok).toBe(false);
    installation.resolve({ ok: true });
    await mutation;
    await launch;
    expect(launched).toBe(true);
  });

  it("backs off failed installs and respects disabling while online", async () => {
    const { coordinator, deps, update } = fixture();
    update.mockResolvedValue({ ok: false });
    await coordinator.sweep(0);
    await coordinator.sweep(60_000);
    expect(update).toHaveBeenCalledOnce();
    deps.enabled.mockReturnValue(false);
    await coordinator.sweep(15 * 60_000);
    expect(update).toHaveBeenCalledOnce();
    deps.enabled.mockReturnValue(true);
    await coordinator.sweep(16 * 60_000);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
