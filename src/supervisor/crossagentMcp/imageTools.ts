import type { ToolSpec, McpToolResult } from "./types";
import type { SubagentToolContext } from "./toolRegistry";
import { jsonResult, parseWaitTimeoutMs } from "./toolResult";

export const IMAGE_TOOLS: ToolSpec[] = [
  {
    name: "list_image_providers",
    description:
      "List available native image generation/editing providers using signed-in accounts, with their actual image model. API billing is excluded.",
    inputSchema: { type: "object", properties: {} },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "create_image",
    description:
      "Generate an image, or edit references, through a signed-in account's native image tool. Returns run_id immediately. Collect the validated file and inline preview with get_image_result. Unavailable image model requests fail. Runs with worker permissions; constrain the prompt to the requested image. Requires a local project and a NEW output path.",
    inputSchema: {
      type: "object",
      required: ["provider", "prompt", "output_path"],
      properties: {
        provider: { type: "string", description: "Provider id from list_image_providers." },
        prompt: { type: "string", description: "Image description or editing instructions." },
        output_path: {
          type: "string",
          description: "New project-relative PNG path. Existing files are protected.",
        },
        reference_paths: {
          type: "array",
          maxItems: 5,
          items: { type: "string" },
          description:
            "Existing project-relative PNG/JPEG/WebP references for edits. Keep originals.",
        },
        image_model: {
          type: "string",
          description:
            "Optional exact image model from list_image_providers, not the reasoning model.",
        },
      },
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "get_image_result",
    description:
      "Wait for an image task and validate the produced raster file. Running tasks remain alive after the wait timeout. Reports the image model, path, dimensions and integration status; completed images are shown inline. Use cancel to stop the task.",
    inputSchema: {
      type: "object",
      required: ["run_id"],
      properties: {
        run_id: { type: "string" },
        timeout_s: { type: "number", minimum: 0, maximum: 240, default: 120 },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

export async function dispatchImageTool(
  name: string,
  args: Record<string, unknown>,
  ctx: SubagentToolContext,
): Promise<McpToolResult | undefined> {
  if (!IMAGE_TOOLS.some((tool) => tool.name === name)) return undefined;
  const images = ctx.runManager.subscriptionImages;
  if (name === "get_image_result") {
    if (typeof args.run_id !== "string") throw new Error("run_id is required");
    return jsonResult(
      await images.result(ctx.parentThreadId, args.run_id, parseWaitTimeoutMs(args)),
    );
  }
  const allowed = (await ctx.listSpawnableAgents()).map((agent) => agent.provider.value);
  if (name === "list_image_providers") return jsonResult(images.providers(allowed));
  return jsonResult(await images.start(ctx.parentThreadId, args, allowed));
}
