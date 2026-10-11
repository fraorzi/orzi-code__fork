import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentVersionService } from "./agentVersionService";
import { AgentUpdateCoordinator } from "./agentUpdateCoordinator";
import { getManagedExecutable, setManagedExecutable } from "../agents/managedExecutable";

describe("managed version action coordination", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "orzi-version-actions-"));
  });
  afterEach(() => {
    setManagedExecutable("fixture-runtime", undefined);
    rmSync(root, { recursive: true, force: true });
  });
  function make(busy: boolean) {
    const capability = {
      npmPackage: "@fixture/runtime",
      binary: "fixture-runtime",
      verifyInstallation: vi.fn<(path: string) => Promise<void>>().mockResolvedValue(undefined),
    };
    const updates = new AgentUpdateCoordinator({
      enabled: () => true,
      hasSessions: () => busy,
      tasks: async () => [],
      report: () => {},
    });
    const refresh = vi.fn<(kinds: string[]) => Promise<void>>().mockResolvedValue(undefined);
    const service = new AgentVersionService({
      baseDir: root,
      adapters: () =>
        new Map([
          ["fixture", { kind: "fixture", managedVersions: capability }],
          ["fixture:work", { kind: "fixture:work", managedVersions: capability }],
          ["unsupported", { kind: "unsupported" }],
        ]),
      updates,
      refresh,
    });
    return { service, capability, updates, refresh };
  }
  it("defers version changes while a runtime session is active", async () => {
    const { service, refresh } = make(true);
    const result = await service.manage({
      agentKind: "fixture",
      action: "install",
      version: "1.0.0",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("sessions close");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("defers switching while a launch is reserved", async () => {
    const { service, updates } = make(false);
    const release = await updates.acquireLaunch();
    expect((await service.manage({ agentKind: "fixture", action: "system" })).ok).toBe(false);
    release();
    expect((await service.manage({ agentKind: "fixture", action: "system" })).ok).toBe(true);
  });
  it("refreshes every profile sharing the declared installation", async () => {
    const { service, refresh } = make(false);
    expect((await service.manage({ agentKind: "fixture:work", action: "system" })).ok).toBe(true);
    expect(refresh).toHaveBeenCalledWith(["fixture", "fixture:work"]);
  });
  it("reports a committed change as successful even when status refresh fails", async () => {
    const { service, refresh } = make(false);
    refresh.mockRejectedValueOnce(new Error("offline status fixture"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect((await service.manage({ agentKind: "fixture", action: "system" })).ok).toBe(true);
      expect(warning).toHaveBeenCalledOnce();
    } finally {
      warning.mockRestore();
    }
  });
  it("keeps undeclared and unknown providers unsupported", async () => {
    const { service } = make(false);
    expect(service.getState({ agentKind: "unsupported" })).toEqual({ supported: false });
    expect(await service.manage({ agentKind: "missing", action: "system" })).toEqual({
      ok: false,
      state: { supported: false },
    });
  });

  it("loads persisted state after the supervisor has populated its initially empty adapter map", () => {
    mkdirSync(join(root, "agent-versions"));
    writeFileSync(join(root, "agent-versions", "active.json"), '{"version":999,"records":[]}');
    const adapters = new Map<
      string,
      {
        kind: string;
        managedVersions?: {
          npmPackage: string;
          binary: string;
          verifyInstallation(path: string): Promise<void>;
        };
      }
    >();
    const updates = new AgentUpdateCoordinator({
      enabled: () => true,
      hasSessions: () => false,
      tasks: async () => [],
      report: () => {},
    });
    const service = new AgentVersionService({
      baseDir: root,
      adapters: () => adapters,
      updates,
      refresh: async () => {},
    });
    adapters.set("fixture", {
      kind: "fixture",
      managedVersions: {
        npmPackage: "@fixture/runtime",
        binary: "fixture-runtime",
        verifyInstallation: async () => {},
      },
    });
    service.initialize();
    expect(service.getState({ agentKind: "fixture" })).toMatchObject({
      supported: true,
      error: expect.any(String),
    });
    expect(() => getManagedExecutable("fixture-runtime")).toThrow("repair");
  });
});
