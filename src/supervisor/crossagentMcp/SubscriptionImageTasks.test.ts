import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentCapabilitySchema, type RuntimeEvent } from "@/shared/contracts";
import type { AgentAdapter } from "@/supervisor/agents/base";
import { SubagentRunManager } from "./SubagentRunManager";
import { dispatchTool } from "./toolRegistry";
import type { AgentSubscriptionImages } from "@/supervisor/agents/base/types";
import { SubscriptionImageTasks } from "./SubscriptionImageTasks";
import { readProjectImage } from "./imageFiles";
import type { SubagentWaitResult } from "./types";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
let directory: string;
let project: string;
let worker: string;
beforeEach(async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  directory = await mkdtemp(resolve(".tmp/image-task-"));
  project = join(directory, "project");
  worker = join(directory, "worker", "nested");
  await mkdir(project);
  await mkdir(worker, { recursive: true });
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function harness() {
  const events: RuntimeEvent[] = [];
  const prepareTask = vi.fn<AgentSubscriptionImages["prepareTask"]>(
    async () => "native image task",
  );
  const spawn = vi.fn<() => { runId: string }>(() => ({ runId: "image-run" }));
  const wait = vi.fn<() => Promise<SubagentWaitResult>>(async () => ({
    status: "completed",
    output: "created",
  }));
  const tasks = new SubscriptionImageTasks({
    adapters: new Map([
      [
        "image-worker",
        {
          kind: "image-worker",
          subscriptionImages: {
            model: "native-image",
            label: "Native image",
            execution: "one-shot",
            prepareTask,
          },
        },
      ],
    ]),
    host: {
      getParentContext: () => ({
        projectLocation: { kind: "posix", path: project },
        config: { model: "parent-model" },
      }),
      appendRuntimeEvent: (_threadId, event) => events.push(event),
    },
    spawn,
    wait,
  });
  return { tasks, spawn, wait, events, prepareTask };
}
const input = { provider: "image-worker", prompt: "blue bird", output_path: "bird.png" };
const allowed = ["image-worker"];

describe("subscription image tasks", () => {
  it("runs an account-image capability through a real supervisor child and MCP result dispatch", async () => {
    const events: RuntimeEvent[] = [];
    const structured = vi.fn<() => Promise<never>>(async () => {
      throw new Error("Wrong harness");
    });
    const adapter: AgentAdapter = {
      kind: "image-worker",
      label: "Image worker",
      capabilities: agentCapabilitySchema.parse({
        models: [{ id: "reasoning", label: "Reasoning" }],
      }),
      buildLaunchArgv: () => {
        throw new Error("Unused terminal launcher");
      },
      buildResumeArgv: () => {
        throw new Error("Unused terminal launcher");
      },
      createInitialSessionRef: () => undefined,
      detectInstall: async () => {
        throw new Error("Unused detection");
      },
      subagentExecutionPreference: "structured",
      createStructuredSession: structured,
      subscriptionImages: {
        model: "native-image",
        label: "Native image",
        execution: "one-shot",
        prepareTask: async (request) => JSON.stringify(request),
      },
      buildSubagentOneShotCommand: ({ prompt }) => ({
        command: process.execPath,
        args: [
          "-e",
          "const fs = require('node:fs'); const task = JSON.parse(process.argv[1]); fs.writeFileSync(task.outputPath, Buffer.from(process.argv[2], 'base64')); process.stdout.write('Image fixture saved');",
          prompt,
          png.toString("base64"),
        ],
        stdin: "",
      }),
    };
    const manager = new SubagentRunManager({
      adapters: new Map([[adapter.kind, adapter]]),
      host: {
        getParentContext: () => ({
          projectLocation: { kind: "posix", path: project },
          config: { model: "parent" },
        }),
        appendRuntimeEvent: (_id, event) => events.push(event),
      },
    });
    const ctx = {
      parentThreadId: "parent",
      runManager: manager,
      listSpawnableAgents: async () => [
        {
          provider: { value: adapter.kind, label: adapter.label },
          defaultModel: "reasoning",
          models: [],
          reasoningOptions: [],
          permissions: {
            options: [{ value: "full-access" as const, label: "Full access" }],
            default: "full-access" as const,
          },
          execution: "structured" as const,
        },
      ],
    };
    const created = await dispatchTool("create_image", input, ctx);
    const run = JSON.parse(created.content[0]?.text ?? "{}");
    expect(typeof run.run_id).toBe("string");
    const result = await dispatchTool(
      "get_image_result",
      { run_id: run.run_id, timeout_s: 5 },
      ctx,
    );
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      status: "completed",
      image: { width: 1, height: 1 },
    });
    expect(structured).not.toHaveBeenCalled();
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "item.completed",
        itemId: `subscription-image:${run.run_id}`,
        payload: expect.objectContaining({
          images: [expect.stringContaining("data:image/png;base64,")],
        }),
      }),
    );
    expect(await readFile(join(project, "bird.png"))).toEqual(png);
    manager.cancelAllForThread("parent");
  });
  it("reserves an output during asynchronous preparation to prevent concurrent writers", async () => {
    const { tasks, prepareTask, spawn } = harness();
    let release = () => {};
    prepareTask.mockImplementation(
      () =>
        new Promise<string>((complete) => {
          release = () => complete("image task");
        }),
    );
    const started = tasks.start("parent", input, allowed);
    await vi.waitFor(() => expect(prepareTask).toHaveBeenCalled());
    await expect(
      tasks.start("parent", { ...input, output_path: "./bird.png" }, allowed),
    ).rejects.toThrow("Another image task");
    release();
    await started;
    expect(spawn).toHaveBeenCalledTimes(1);
  });
  it("releases a cancelled task's output and keeps its old result from unlocking a newer writer", async () => {
    const { tasks, spawn, wait } = harness();
    spawn.mockReturnValueOnce({ runId: "old-run" }).mockReturnValueOnce({ runId: "new-run" });
    await tasks.start("parent", input, allowed);
    tasks.settled("old-run");
    await tasks.start("parent", input, allowed);
    wait.mockResolvedValue({ status: "cancelled", output: "cancelled" });
    expect(await tasks.result("parent", "old-run", 0)).toMatchObject({ status: "cancelled" });
    await expect(tasks.start("parent", input, allowed)).rejects.toThrow("Another image task");
    tasks.settled("new-run");
    await expect(tasks.start("parent", input, allowed)).resolves.toMatchObject({
      status: "running",
    });
  });
  it("validates a real output file, emits one inline image and scopes result ownership", async () => {
    const { tasks, spawn, events } = harness();
    expect(tasks.providers([])).toEqual([]);
    expect(tasks.providers(allowed)).toMatchObject([
      { billing: "account", image_model: "native-image" },
    ]);
    await tasks.start("parent", input, allowed);
    expect(spawn).toHaveBeenCalledWith(
      "parent",
      expect.objectContaining({ execution: "one-shot", agent: "image-worker" }),
    );
    await expect(tasks.result("another-thread", "image-run", 0)).rejects.toThrow("Unknown image");
    await writeFile(join(project, "bird.png"), png);
    expect(await tasks.result("parent", "image-run", 0)).toMatchObject({
      status: "completed",
      image: { width: 1, height: 1, path: join(project, "bird.png") },
    });
    await tasks.result("parent", "image-run", 0);
    expect(events.filter((event) => event.type === "item.completed")).toHaveLength(1);
    tasks.clearThread("parent");
    await expect(tasks.result("parent", "image-run", 0)).rejects.toThrow("Unknown image");
  });
  it("rejects unsupported model, disabled provider, traversal, existing outputs and external symlinks before spawning", async () => {
    const { tasks, spawn } = harness();
    await writeFile(join(project, "existing.png"), png);
    await symlink(directory, join(project, "outside"));
    for (const request of [
      { ...input, image_model: "unavailable-pro" },
      { ...input, output_path: "../escape.png" },
      { ...input, output_path: "existing.png" },
      { ...input, output_path: "outside/new/image.png" },
      { ...input, reference_paths: ["outside/existing.png"] },
    ])
      await expect(tasks.start("parent", request, allowed)).rejects.toThrow(
        /unavailable|outside|already exists/,
      );
    await expect(tasks.start("parent", input, [])).rejects.toThrow("unavailable");
    expect(spawn).not.toHaveBeenCalled();
    expect(await readFile(join(project, "existing.png"))).toEqual(png);
  });
  it("keeps tasks alive after a wait timeout and rejects a text file masquerading as an image", async () => {
    const { tasks, wait } = harness();
    await tasks.start("parent", input, allowed);
    wait.mockResolvedValueOnce({ status: "running", output: "working" });
    expect(await tasks.result("parent", "image-run", 0)).toMatchObject({ status: "running" });
    await writeFile(join(project, "bird.png"), "generated a wonderful image");
    await expect(tasks.result("parent", "image-run", 0)).rejects.toThrow("raster image");
    await writeFile(join(project, "bird.png"), png);
    expect(await tasks.result("parent", "image-run", 0)).toMatchObject({ image: { width: 1 } });
  });
  it("returns an unintegrated image from the nested worker project and preserves edit references", async () => {
    const { tasks, wait, prepareTask } = harness();
    await writeFile(join(project, "original.png"), png);
    await tasks.start("parent", { ...input, reference_paths: ["original.png"] }, allowed);
    expect(prepareTask).toHaveBeenCalledWith(
      expect.objectContaining({ referencePaths: ["original.png"] }),
    );
    await writeFile(join(worker, "bird.png"), png);
    wait.mockResolvedValue({
      status: "completed",
      output: "created",
      workspace: {
        path: join(directory, "worker"),
        project_path: worker,
        patch_path: join(directory, "patch"),
      },
      integration: { status: "needs_resolution", files: ["nested/bird.png"], message: "conflict" },
    });
    expect(await tasks.result("parent", "image-run", 0)).toMatchObject({
      image: { path: join(worker, "bird.png") },
      integration: { status: "needs_resolution" },
    });
    expect(await readFile(join(project, "original.png"))).toEqual(png);
    await writeFile(join(project, "oversized.png"), Buffer.alloc(20 * 1024 * 1024 + 1));
    await expect(readProjectImage(project, "oversized.png")).rejects.toThrow("20 MiB");
  });
});
