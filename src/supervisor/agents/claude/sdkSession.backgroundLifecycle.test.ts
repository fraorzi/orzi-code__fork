import { expect, it, vi } from "vitest";
import type {
  Query,
  SDKBackgroundTasksChangedMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { FollowUpQueueCoordinator } from "../../runtime/threadSession/followUpQueueCoordinator";
import { createFollowUpQueueHarness } from "../../runtime/threadSessionManager.followUpQueueTestHarness";
import { ClaudeSdkSession } from "./sdkSession";
import {
  assistantMessage,
  resultMessage,
  flushSdkMessages,
  createClaudeTestQuery,
} from "./sdkSessionTestHarness";

const sdk = vi.hoisted(() => ({
  query: vi.fn<(input: { prompt: AsyncIterable<SDKUserMessage> }) => Query>(),
}));
vi.mock("node-pty", () => ({ spawn: vi.fn<() => never>() }));
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: sdk.query }));
vi.mock("../binaryResolver", () => ({ resolveAgentBinaryPath: () => undefined }));

it.each(["direct", "queued"])(
  "delivers a %s follow-up while the completed response's server stays alive",
  async (delivery) => {
    const { output, interrupt, runtime } = createClaudeTestQuery();
    sdk.query.mockReturnValue(runtime);
    const { manager, session, finish } = createFollowUpQueueHarness();
    const queue = (manager as unknown as { followUpQueue: FollowUpQueueCoordinator }).followUpQueue;
    const native = await ClaudeSdkSession.create({
      threadId: session.threadId,
      projectLocation: session.projectLocation,
      config: session.config,
      presentationMode: "gui",
    });
    session.structuredSession = native;
    const start = vi.spyOn(native, "startTurn");
    const errors: string[] = [];
    native.setListener({
      onRuntimeEvent: (event) => queue.onStructuredRuntimeEvent(session, event),
      onUpdate: (update) => {
        session.status = update.status;
        session.attention = update.attention;
        queue.onStructuredUpdate(session, update.status);
      },
      onError: (error) => errors.push(error),
      onClose: () => {},
    });
    try {
      const id = await native.openThread(session.config);
      const inputs = sdk.query.mock.calls.at(-1)![0].prompt[Symbol.asyncIterator]();
      await manager.sendThreadInput({
        threadId: session.threadId,
        prompt: "start server",
        config: session.config,
      });
      expect((await inputs.next()).value?.message.content).toBe("start server");
      output.write({
        type: "system",
        subtype: "background_tasks_changed",
        session_id: id,
        uuid: "00000000-0000-4000-8000-000000000001",
        tasks: [{ task_id: "server", task_type: "local_bash", description: "pnpm dev" }],
      } satisfies SDKBackgroundTasksChangedMessage);
      output.write(assistantMessage(id, "server ready"));
      await flushSdkMessages();
      if (delivery === "queued")
        await manager.queueThreadFollowUp({
          threadId: session.threadId,
          prompt: "next task",
          config: session.config,
        });
      output.write(resultMessage(id));
      await flushSdkMessages();
      if (delivery === "direct")
        await manager.sendThreadInput({
          threadId: session.threadId,
          prompt: "next task",
          config: session.config,
        });
      await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(2));
      expect((await inputs.next()).value?.message.content).toBe("next task");
      expect(native.getBackgroundTasks()).toEqual([
        { taskId: "server", kind: "command", description: "pnpm dev" },
      ]);
      expect(interrupt).not.toHaveBeenCalled();
      output.write(assistantMessage(id, "next response"));
      output.write(resultMessage(id));
      await flushSdkMessages();
      await vi.waitFor(() => expect(session.status).toBe("idle"));
      expect(errors).toEqual([]);
    } finally {
      finish();
      await manager.dispose();
      output.destroy();
      vi.restoreAllMocks();
    }
  },
);
