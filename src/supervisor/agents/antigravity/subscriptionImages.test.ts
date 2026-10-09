import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { antigravitySubscriptionImages, verifyAntigravityImageAccount } from "./subscriptionImages";

let directory: string;
let settings: string;
beforeEach(async () => {
  await mkdir(resolve(".tmp"), { recursive: true });
  directory = await mkdtemp(resolve(".tmp/image-account-"));
  settings = join(directory, "settings.json");
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
const request = {
  prompt: "Remove the background",
  outputPath: "assets/edited.png",
  referencePaths: ["assets/original.png"],
};

describe("Antigravity subscription images", () => {
  it("uses native generate_image with edit references and the actual provider-managed model", async () => {
    const capability = antigravitySubscriptionImages(settings);
    const prompt = await capability.prepareTask(request);
    expect(capability).toMatchObject({ model: "nano-banana-2", execution: "one-shot" });
    expect(prompt).toContain("ImagePaths");
    expect(prompt).toContain("assets/original.png");
    expect(prompt).toContain("assets/edited.png");
    expect(prompt).toContain("ONLY the native generate_image");
    expect(prompt).toContain("Do not claim Nano Banana Pro");
  });
  it("blocks API mode without changing settings, and rechecks a resumed prompt before spawn", async () => {
    const prompt = await antigravitySubscriptionImages(settings).prepareTask(request);
    const apiSettings = JSON.stringify({ modelProvider: "gemini", theme: "dark" });
    await writeFile(settings, apiSettings);
    await expect(antigravitySubscriptionImages(settings).prepareTask(request)).rejects.toThrow(
      "API mode is not supported",
    );
    expect(() =>
      verifyAntigravityImageAccount(`Retained worktree instructions\n${prompt}`, settings),
    ).toThrow("API mode is not supported");
    expect(() => verifyAntigravityImageAccount("ordinary coding task", settings)).not.toThrow();
    expect(await readFile(settings, "utf8")).toBe(apiSettings);
  });
  it("fails closed for unreadable, malformed and unknown provider settings", async () => {
    for (const value of [
      "broken",
      "null",
      '{"modelProvider":true}',
      '{"modelProvider":"future-provider"}',
    ]) {
      await writeFile(settings, value);
      await expect(antigravitySubscriptionImages(settings).prepareTask(request)).rejects.toThrow(
        /account mode|account authentication/,
      );
    }
  });
});
