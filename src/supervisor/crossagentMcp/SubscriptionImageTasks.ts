import { z } from "zod";
import type { AgentKind } from "@/shared/contracts";
import type { AgentAdapter } from "@/supervisor/agents/base";
import type { SubagentRunHost, SpawnAgentRequest, SubagentWaitResult } from "./types";
import { projectImagePath, readProjectImage, requireNewImagePath } from "./imageFiles";

const imageRequestSchema = z.object({
  provider: z.string().min(1),
  prompt: z.string().trim().min(1).max(32_000),
  output_path: z
    .string()
    .min(1)
    .regex(/\.png$/i),
  reference_paths: z.array(z.string().min(1)).max(5).default([]),
  image_model: z.string().optional(),
});

interface ImageTask {
  parentThreadId: string;
  projectPath: string;
  outputPath: string;
  targetPath: string;
  outputClaim: symbol;
  imageModel: string;
  published: boolean;
}

interface ImageTaskDeps {
  adapters: Map<AgentKind, Pick<AgentAdapter, "kind" | "subscriptionImages">>;
  host: SubagentRunHost;
  spawn: (threadId: string, request: SpawnAgentRequest) => { runId: string };
  wait: (runId: string, timeoutMs: number, threadId: string) => Promise<SubagentWaitResult>;
}

/** Uses provider-owned native image tools and the existing supervisor process lifecycle. */
export class SubscriptionImageTasks {
  private readonly tasks = new Map<string, ImageTask>();
  private readonly reservedOutputs = new Map<string, symbol>();
  constructor(private readonly deps: ImageTaskDeps) {}

  providers(allowed: readonly string[]) {
    return [...this.deps.adapters.values()].flatMap((adapter) =>
      adapter.subscriptionImages && allowed.includes(adapter.kind)
        ? [
            {
              provider: adapter.kind,
              image_model: adapter.subscriptionImages.model,
              label: adapter.subscriptionImages.label,
              billing: "account",
              supports_edit: true,
            },
          ]
        : [],
    );
  }

  async start(threadId: string, input: unknown, allowed: readonly string[]) {
    const request = imageRequestSchema.parse(input);
    const adapter = [...this.deps.adapters.values()].find(
      (candidate) => candidate.kind === request.provider,
    );
    const images = adapter?.subscriptionImages;
    if (!images || !allowed.includes(request.provider))
      throw new Error("Subscription image provider is unavailable");
    if (request.image_model && request.image_model !== images.model)
      throw new Error(`Requested image model is unavailable; this provider offers ${images.model}`);
    const parent = this.deps.host.getParentContext(threadId);
    if (!parent || parent.projectLocation.kind !== "posix" || parent.config.executionEnvironment)
      throw new Error("Subscription images require a local project");
    if ([...this.tasks.values()].filter((task) => task.parentThreadId === threadId).length >= 64)
      throw new Error("Too many image tasks in this thread; start a new thread");
    const targetPath = await projectImagePath(parent.projectLocation.path, request.output_path);
    if (this.reservedOutputs.has(targetPath))
      throw new Error("Another image task is writing this output; choose a new path");
    const outputClaim = Symbol();
    this.reservedOutputs.set(targetPath, outputClaim);
    try {
      await requireNewImagePath(parent.projectLocation.path, request.output_path);
      for (const path of request.reference_paths)
        await readProjectImage(parent.projectLocation.path, path);
      const prompt = await images.prepareTask({
        prompt: request.prompt,
        outputPath: request.output_path,
        referencePaths: request.reference_paths,
      });
      const { runId } = this.deps.spawn(threadId, {
        agent: request.provider,
        prompt,
        name: request.prompt.slice(0, 64),
        execution: images.execution,
      });
      this.tasks.set(runId, {
        parentThreadId: threadId,
        projectPath: parent.projectLocation.path,
        outputPath: request.output_path,
        targetPath,
        outputClaim,
        imageModel: images.model,
        published: false,
      });
      return { run_id: runId, status: "running", image_model: images.model };
    } catch (error) {
      if (this.reservedOutputs.get(targetPath) === outputClaim)
        this.reservedOutputs.delete(targetPath);
      throw error;
    }
  }

  async result(threadId: string, runId: string, timeoutMs: number) {
    const task = this.tasks.get(runId);
    if (!task || task.parentThreadId !== threadId) throw new Error("Unknown image run_id");
    const result = await this.deps.wait(runId, timeoutMs, threadId);
    if (result.status !== "running") this.settled(runId);
    if (result.status !== "completed") return { run_id: runId, ...result };
    const projectPath =
      result.workspace &&
      result.integration?.status !== "applied" &&
      result.integration?.status !== "no_changes"
        ? result.workspace.project_path
        : task.projectPath;
    const image = await readProjectImage(projectPath, task.outputPath);
    if (!task.published) {
      const itemId = `subscription-image:${runId}`;
      this.deps.host.appendRuntimeEvent(threadId, {
        type: "item.started",
        threadId,
        itemId,
        itemType: "tool_call",
        payload: { name: "subscription_image", status: "running" },
      });
      this.deps.host.appendRuntimeEvent(threadId, {
        type: "item.completed",
        threadId,
        itemId,
        payload: {
          name: "subscription_image",
          status: "success",
          images: [image.dataUrl],
          result: {
            path: image.path,
            width: image.width,
            height: image.height,
            image_model: task.imageModel,
          },
        },
      });
      task.published = true;
    }
    return {
      run_id: runId,
      ...result,
      image: {
        path: image.path,
        mime: image.mime,
        width: image.width,
        height: image.height,
        image_model: task.imageModel,
      },
    };
  }

  clearThread(threadId: string): void {
    for (const [id, task] of this.tasks)
      if (task.parentThreadId === threadId) {
        this.settled(id);
        this.tasks.delete(id);
      }
  }

  settled(runId: string): void {
    const task = this.tasks.get(runId);
    if (task && this.reservedOutputs.get(task.targetPath) === task.outputClaim)
      this.reservedOutputs.delete(task.targetPath);
  }
}
