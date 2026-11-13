import type { AuxiliaryGenerationMeasurement } from "@/shared/auxiliaryUsage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JudgeExperimentPayload } from "@/shared/contracts";
import type { AgentAdapter } from "../agents/base";

const mocks = vi.hoisted(() => ({
  judgeExperiment: vi.fn<(...args: unknown[]) => Promise<never>>(),
  generateTitle: vi.fn<typeof import("../titleGenerator").generateTitle>(),
  generateCommitMessage: vi.fn<typeof import("../commitMessageGenerator").generateCommitMessage>(),
  generatePrSummary: vi.fn<typeof import("../prSummaryGenerator").generatePrSummary>(),
}));

vi.mock("../experimentJudge", () => ({
  judgeExperiment: mocks.judgeExperiment,
}));

vi.mock("../titleGenerator", () => ({ generateTitle: mocks.generateTitle }));
vi.mock("../commitMessageGenerator", () => ({
  generateCommitMessage: mocks.generateCommitMessage,
}));
vi.mock("../prSummaryGenerator", () => ({ generatePrSummary: mocks.generatePrSummary }));

import { GenerationService } from "./generationService";

const payload: JudgeExperimentPayload = {
  experimentId: "experiment-1",
  projectLocation: { kind: "windows", path: "C:\\repo" },
  agentKind: "claude",
  prompt: "Choose the best solution",
  candidates: [
    { threadId: "thread-1", diff: "first" },
    { threadId: "thread-2", diff: "second" },
  ],
};

describe("GenerationService experiment judge cancellation", () => {
  beforeEach(() => {
    mocks.judgeExperiment.mockReset();
  });

  it("keeps the replacement run cancellable after the superseded run settles", async () => {
    const signals: AbortSignal[] = [];
    mocks.judgeExperiment.mockImplementation(
      async (...args: unknown[]) =>
        new Promise<never>((_resolve, reject) => {
          const options = args[7] as { signal: AbortSignal };
          signals.push(options.signal);
          options.signal.addEventListener(
            "abort",
            () => reject(new DOMException("The operation was aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const adapter = { kind: "claude", label: "Claude" } as AgentAdapter;
    const service = new GenerationService({
      adapters: new Map([["claude", adapter]]),
      readTerminalScrollback: () => "",
      wslBridgeClient: undefined,
    });

    const first = service.judgeExperiment(payload).catch((error: unknown) => error);
    await vi.waitFor(() => expect(signals).toHaveLength(1));
    const second = service.judgeExperiment(payload).catch((error: unknown) => error);
    await vi.waitFor(() => expect(signals).toHaveLength(2));

    await expect(first).resolves.toMatchObject({ name: "AbortError" });
    service.cancelJudgeExperiment(payload.experimentId);
    await expect(second).resolves.toMatchObject({ name: "AbortError" });
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});

describe("GenerationService measured auxiliary activity", () => {
  it("preserves results and provider failures when the usage observer throws", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const service = new GenerationService({
      adapters: new Map([["test", { kind: "test", label: "Test" } as AgentAdapter]]),
      readTerminalScrollback: () => "",
      wslBridgeClient: undefined,
      onAuxiliaryGeneration: () => {
        throw new Error("reporting unavailable");
      },
    });
    const input = {
      projectLocation: { kind: "posix", path: "/fixture" } as const,
      agentKind: "test",
      prompt: "prompt",
    };
    const failure = new Error("original provider failure");
    mocks.generateTitle.mockResolvedValueOnce("Generated").mockRejectedValueOnce(failure);
    try {
      await expect(service.generateTitle(input)).resolves.toEqual({ title: "Generated" });
      await expect(service.generateTitle(input)).rejects.toBe(failure);
      expect(mocks.generateTitle).toHaveBeenCalledTimes(2);
      expect(warning).toHaveBeenCalledTimes(2);
    } finally {
      warning.mockRestore();
    }
  });

  it("attributes title/commit/PR reports without creating chat threads", async () => {
    const onAuxiliaryGeneration = vi.fn<(measurement: AuxiliaryGenerationMeasurement) => void>();
    const adapter = { kind: "test", label: "Test" } as AgentAdapter;
    const service = new GenerationService({
      adapters: new Map([["test", adapter]]),
      readTerminalScrollback: () => "",
      wslBridgeClient: undefined,
      onAuxiliaryGeneration,
    });
    mocks.generateTitle.mockImplementationOnce(async (...args) => {
      args[7]?.({ model: "actual", totalTokens: 12 });
      return "Title";
    });
    mocks.generateCommitMessage.mockImplementationOnce(async (...args) => {
      args[6]?.({ totalTokens: 0 });
      return "commit";
    });
    mocks.generatePrSummary.mockResolvedValueOnce({ title: "PR", description: "body" });
    const common = {
      projectLocation: { kind: "windows", path: "C:\\repo" },
      agentKind: "test",
      model: "requested",
      effort: "low",
    } as const;
    await expect(service.generateTitle({ ...common, prompt: "prompt" })).resolves.toEqual({
      title: "Title",
    });
    await expect(service.generateCommitMessage(common)).resolves.toEqual({ message: "commit" });
    await expect(
      service.generatePrSummary({ ...common, branch: "feature", baseBranch: "main" }),
    ).resolves.toEqual({ title: "PR", description: "body" });
    const events = onAuxiliaryGeneration.mock.calls.map(([event]) => event);
    expect(events).toHaveLength(3);
    expect(events).toEqual([
      expect.objectContaining({
        operation: "title",
        provider: "test",
        model: "requested",
        outcome: "completed",
        usage: [{ model: "actual", totalTokens: 12 }],
      }),
      expect.objectContaining({
        operation: "commit",
        outcome: "completed",
        usage: [{ totalTokens: 0 }],
      }),
      expect.objectContaining({ operation: "pr", outcome: "completed", usage: [] }),
    ]);
    expect(new Set(events.map((event) => event.id)).size).toBe(3);
    expect(events.every((event) => event.finishedAt >= event.startedAt)).toBe(true);
  });

  it("records reported consumption from failed runs and preserves the original error", async () => {
    const onAuxiliaryGeneration = vi.fn<(measurement: AuxiliaryGenerationMeasurement) => void>();
    const adapter = { kind: "test", label: "Test" } as AgentAdapter;
    const service = new GenerationService({
      adapters: new Map([["test", adapter]]),
      readTerminalScrollback: () => "",
      wslBridgeClient: undefined,
      onAuxiliaryGeneration,
    });
    const failure = new Error("provider error");
    mocks.generateTitle.mockImplementationOnce(async (...args) => {
      args[7]?.({ totalTokens: 9 });
      throw failure;
    });
    await expect(
      service.generateTitle({
        projectLocation: { kind: "windows", path: "C:\\repo" },
        agentKind: "test",
        prompt: "prompt",
      }),
    ).rejects.toBe(failure);
    expect(onAuxiliaryGeneration).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ outcome: "failed", usage: [{ totalTokens: 9 }] }),
    );
  });
});
