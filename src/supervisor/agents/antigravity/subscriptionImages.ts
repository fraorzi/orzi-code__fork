import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { AgentSubscriptionImages } from "../base/types";

const IMAGE_TASK_INSTRUCTION =
  "Create the requested raster image using ONLY the native generate_image tool on the signed-in Google account.";

function assertAccountMode(settingsPath: string): void {
  let settings: unknown = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw new Error("Cannot verify Antigravity account mode; image task was not started", {
        cause: error,
      });
  }
  const parsed = z.object({ modelProvider: z.string().optional() }).safeParse(settings);
  if (!parsed.success || parsed.data.modelProvider)
    throw new Error(
      "Subscription images require default Google account authentication. Remove modelProvider from Antigravity CLI settings and sign in with agy. API mode is not supported.",
    );
}

/** Recheck immediately before process spawn, including a retained task resumed later. */
export function verifyAntigravityImageAccount(
  prompt: string,
  settingsPath = join(homedir(), ".gemini", "antigravity-cli", "settings.json"),
): void {
  if (prompt.includes(IMAGE_TASK_INSTRUCTION)) assertAccountMode(settingsPath);
}

/** Account-only image tasks. Never change settings or borrow credentials. */
export function antigravitySubscriptionImages(
  settingsPath = join(homedir(), ".gemini", "antigravity-cli", "settings.json"),
): AgentSubscriptionImages {
  return {
    model: "nano-banana-2",
    label: "Nano Banana 2 (provider managed)",
    execution: "one-shot",
    async prepareTask({ prompt, outputPath, referencePaths }) {
      assertAccountMode(settingsPath);
      return [
        `${IMAGE_TASK_INSTRUCTION} Do not use an API key, HTTP image endpoint, browser, paid credits purchase, or a substitute drawing script. If the native tool is unavailable or quota is exhausted, report the failure and stop.`,
        "The image model is provider-managed Nano Banana 2. Do not claim Nano Banana Pro or select a different image model.",
        `Image request: ${JSON.stringify(prompt)}`,
        `Call generate_image with Prompt containing the request, ImageName describing the image${referencePaths.length ? `, and ImagePaths referencing these existing files relative to your current project directory: ${JSON.stringify(referencePaths)}` : "."}`,
        `Copy the resulting native image artifact as a PNG to this NEW path relative to your current project directory: ${JSON.stringify(outputPath)}. Create parent directories if needed. Never overwrite an existing file. Preserve the reference images and all other project files. Report the final path and any generation errors.`,
      ].join("\n\n");
    },
  };
}
