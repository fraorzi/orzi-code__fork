import { randomUUID } from "node:crypto";
import type {
  AuxiliaryGenerationMeasurement,
  AuxiliaryOperation,
  OneShotUsage,
} from "@/shared/auxiliaryUsage";
import type {
  AgentKind,
  ExtractContextPayload,
  ExtractContextResult,
  GenerateCommitMessagePayload,
  GenerateCommitMessageResult,
  GeneratePrSummaryPayload,
  GeneratePrSummaryResult,
  GenerateTitlePayload,
  GenerateTitleResult,
  JudgeExperimentPayload,
  JudgeExperimentResult,
} from "@/shared/contracts";
import { generateCommitMessage } from "../commitMessageGenerator";
import {
  extractContext as extractContextFn,
  extractContextFromScrollback,
} from "../contextExtractor";
import { generatePrSummary } from "../prSummaryGenerator";
import { generateTitle } from "../titleGenerator";
import { judgeExperiment } from "../experimentJudge";
import type { AgentAdapter } from "../agents/base";
import type { WslBridgeClient } from "../wsl/bridge/client";

export interface GenerationServiceDeps {
  onAuxiliaryGeneration?: (measurement: AuxiliaryGenerationMeasurement) => void;
  adapters: Map<AgentKind, AgentAdapter>;
  readTerminalScrollback: (threadId: string) => string;
  wslBridgeClient: WslBridgeClient | undefined;
}

/**
 * Owns the AI-assisted generation entry points (commit message, thread title,
 * PR summary) and thread-context extraction, including the per-thread abort
 * controllers that back `cancelExtractContext`. Extracted verbatim from
 * `SupervisorRuntime`; the runtime keeps thin delegates.
 */
export class GenerationService {
  private readonly extractionAbortControllers = new Map<string, AbortController>();
  private readonly judgeAbortControllers = new Map<string, AbortController>();

  constructor(private readonly deps: GenerationServiceDeps) {}

  private requireAdapter(kind: AgentKind): AgentAdapter {
    const adapter = this.deps.adapters.get(kind);
    if (!adapter) {
      throw new Error(`Unsupported agent adapter: ${kind}`);
    }
    return adapter;
  }

  async generateCommitMessage(
    payload: GenerateCommitMessagePayload,
  ): Promise<GenerateCommitMessageResult> {
    const adapter = this.requireAdapter(payload.agentKind);
    return this.measure("commit", payload, async (onUsage) => ({
      message: await generateCommitMessage(
        payload.projectLocation,
        adapter,
        payload.model,
        payload.effort,
        payload.language,
        payload.fast,
        onUsage,
      ),
    }));
  }

  async generateTitle(payload: GenerateTitlePayload): Promise<GenerateTitleResult> {
    const adapter = this.requireAdapter(payload.agentKind);
    return this.measure("title", payload, async (onUsage) => ({
      title: await generateTitle(
        payload.projectLocation,
        adapter,
        payload.prompt,
        payload.model,
        payload.effort,
        payload.language,
        payload.fast,
        onUsage,
      ),
    }));
  }

  async generatePrSummary(payload: GeneratePrSummaryPayload): Promise<GeneratePrSummaryResult> {
    const adapter = this.requireAdapter(payload.agentKind);
    return this.measure("pr", payload, (onUsage) =>
      generatePrSummary(
        payload.projectLocation,
        adapter,
        payload.branch,
        payload.baseBranch,
        payload.model,
        payload.effort,
        payload.language,
        onUsage,
      ),
    );
  }

  private async measure<T>(
    operation: AuxiliaryOperation,
    payload: { agentKind: AgentKind; model?: string | undefined; effort?: string | undefined },
    run: (onUsage: (usage: OneShotUsage) => void) => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    const usage: OneShotUsage[] = [];
    let outcome: AuxiliaryGenerationMeasurement["outcome"] = "failed";
    try {
      const result = await run((sample) => usage.push(sample));
      outcome = "completed";
      return result;
    } finally {
      try {
        this.deps.onAuxiliaryGeneration?.({
          id: randomUUID(),
          operation,
          provider: payload.agentKind,
          ...(payload.model ? { model: payload.model } : {}),
          ...(payload.effort ? { effort: payload.effort } : {}),
          startedAt,
          finishedAt: Date.now(),
          outcome,
          usage,
        });
      } catch (error) {
        // Reporting must not replace a completed result or a provider failure.
        console.warn("[generation] unable to report auxiliary usage", error);
      }
    }
  }

  async judgeExperiment(payload: JudgeExperimentPayload): Promise<JudgeExperimentResult> {
    const adapter = this.requireAdapter(payload.agentKind);
    const abortController = new AbortController();
    this.judgeAbortControllers.get(payload.experimentId)?.abort();
    this.judgeAbortControllers.set(payload.experimentId, abortController);
    try {
      return await judgeExperiment(
        payload.projectLocation,
        adapter,
        payload.prompt,
        payload.candidates,
        payload.model,
        payload.effort,
        payload.fast,
        {
          signal: abortController.signal,
          ...(this.deps.wslBridgeClient ? { wslClient: this.deps.wslBridgeClient } : {}),
          ...(payload.mode ? { mode: payload.mode } : {}),
        },
      );
    } finally {
      if (this.judgeAbortControllers.get(payload.experimentId) === abortController) {
        this.judgeAbortControllers.delete(payload.experimentId);
      }
    }
  }

  cancelJudgeExperiment(experimentId: string): void {
    const controller = this.judgeAbortControllers.get(experimentId);
    if (controller) {
      controller.abort();
      this.judgeAbortControllers.delete(experimentId);
    }
  }

  async extractContext(payload: ExtractContextPayload): Promise<ExtractContextResult> {
    const adapter = this.requireAdapter(payload.agentKind);
    const abortController = new AbortController();
    this.extractionAbortControllers.set(payload.threadId, abortController);

    try {
      try {
        return await extractContextFn(
          payload.projectLocation,
          adapter,
          payload.sessionRef,
          payload.worktreePath,
          payload.model,
          payload.effort,
          abortController.signal,
        );
      } catch {
        const scrollback = this.deps.readTerminalScrollback(payload.threadId);
        if (scrollback) {
          return extractContextFromScrollback(
            payload.projectLocation,
            adapter,
            scrollback,
            payload.agentKind,
            payload.sessionRef.providerSessionId,
            payload.worktreePath,
            payload.model,
            payload.effort,
            abortController.signal,
          );
        }
        throw new Error(
          `Cannot extract context from ${adapter.label}: no session resume or scrollback available`,
        );
      }
    } finally {
      this.extractionAbortControllers.delete(payload.threadId);
    }
  }

  cancelExtractContext(threadId: string): void {
    const controller = this.extractionAbortControllers.get(threadId);
    if (controller) {
      controller.abort();
      this.extractionAbortControllers.delete(threadId);
    }
  }
}
