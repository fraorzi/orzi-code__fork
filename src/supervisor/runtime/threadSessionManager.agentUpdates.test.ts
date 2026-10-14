import { spawn } from "node:child_process";
import { once } from "node:events";
import { AgentUpdateCoordinator } from "./agentUpdateCoordinator";
import { expect, it, vi } from "vitest";
import { createFollowUpQueueHarness } from "./threadSessionManager.followUpQueueTestHarness";

vi.mock("node-pty", () => ({ spawn: vi.fn<() => never>() }));

it("closes only resumable idle GUI sessions and retains their session reference", async () => {
  const { manager, session, finish } = createFollowUpQueueHarness();
  session.sessionRef = {
    providerSessionId: "saved-session",
    discoveredAt: new Date().toISOString(),
  };
  try {
    expect(manager.hasAgentUpdateBlockers()).toBe(false);
    await manager.closeIdleAgentSessions();
    expect(manager.sessions.size).toBe(0);
    expect(session.status).toBe("inactive");
    expect(session.sessionRef.providerSessionId).toBe("saved-session");
  } finally {
    finish();
    await manager.dispose();
  }
});

it.each(["working", "launching", "needs_approval", "needs_reply"] as const)(
  "blocks updates for a %s session",
  async (status) => {
    const { manager, session, finish } = createFollowUpQueueHarness();
    session.status = status;
    session.sessionRef = { providerSessionId: "saved", discoveredAt: new Date().toISOString() };
    try {
      expect(manager.hasAgentUpdateBlockers()).toBe(true);
      await expect(manager.closeIdleAgentSessions()).rejects.toThrow("Update deferred");
      expect(manager.sessions.get(session.threadId)).toBe(session);
    } finally {
      finish();
      await manager.dispose();
    }
  },
);

it("keeps terminal processes and GUI sessions without a resumable id", async () => {
  const { manager, session, finish } = createFollowUpQueueHarness();
  try {
    expect(manager.hasAgentUpdateBlockers()).toBe(true);
    session.sessionRef = { providerSessionId: "saved", discoveredAt: new Date().toISOString() };
    session.presentationMode = "terminal";
    expect(manager.hasAgentUpdateBlockers()).toBe(true);
  } finally {
    finish();
    await manager.dispose();
  }
});

it("blocks updates during asynchronous prompt admission while status is still idle", async () => {
  const { manager, session, startTurn, finish } = createFollowUpQueueHarness();
  session.sessionRef = { providerSessionId: "saved", discoveredAt: new Date().toISOString() };
  startTurn.mockImplementation(async () => {});
  try {
    await manager.sendThreadInput({
      threadId: session.threadId,
      prompt: "hello",
      config: session.config,
    });
    expect(session.status).toBe("idle");
    expect(manager.hasAgentUpdateBlockers()).toBe(true);
  } finally {
    finish();
    await manager.dispose();
  }
});

it("closes failed resumable GUI sessions but preserves native background work", async () => {
  const { manager, session, finish } = createFollowUpQueueHarness();
  session.sessionRef = { providerSessionId: "saved", discoveredAt: new Date().toISOString() };
  session.status = "error";
  try {
    expect(manager.hasAgentUpdateBlockers()).toBe(false);
    session.structuredSession!.getBackgroundTasks = () => [
      { taskId: "live", kind: "command", description: "Still running" },
    ];
    expect(manager.hasAgentUpdateBlockers()).toBe(true);
    await expect(manager.closeIdleAgentSessions()).rejects.toThrow("Update deferred");
    expect(manager.sessions.get(session.threadId)).toBe(session);
  } finally {
    finish();
    await manager.dispose();
  }
});

it("waits for the real idle provider process to exit before replacing files", async () => {
  const { manager, session, finish } = createFollowUpQueueHarness();
  session.sessionRef = { providerSessionId: "saved", discoveredAt: new Date().toISOString() };
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  const closed = once(child, "exit");
  await once(child, "spawn");
  session.structuredSession!.dispose = async () => {
    child.kill();
    await closed;
  };
  const updates = new AgentUpdateCoordinator({
    enabled: () => true,
    hasSessions: () => manager.hasAgentUpdateBlockers(),
    closeIdleSessions: () => manager.closeIdleAgentSessions(),
    tasks: async () => [],
    report: () => {},
  });
  try {
    const result = await updates.install(async () => {
      expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
      expect(manager.sessions.size).toBe(0);
      return { ok: true };
    });
    expect(result.ok).toBe(true);
  } finally {
    child.kill();
    finish();
    await manager.dispose();
  }
});
