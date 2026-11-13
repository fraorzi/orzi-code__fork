import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, posix } from "node:path";
import { z } from "zod";
import type { ProjectLocation } from "@/shared/contracts";
import { toWslUncPath } from "@/shared/wsl";
import { resolveWslHomeDirectory } from "../base";

const settingsSchema = z.object({
  env: z.object({ CLAUDE_CODE_ENTRYPOINT: z.string().trim().min(1).optional() }).optional(),
});

/**
 * Identify app-owned SDK/print calls as this client, rather than inheriting a
 * host application's identity or the SDK default. Explicit profile and Claude
 * settings overrides are respected. Never apply this to interactive PTYs.
 */
export function claudeHeadlessEnvironment(
  location?: ProjectLocation,
  overrides: Record<string, string> = {},
): Record<string, string> {
  let settingsPath: string | undefined;
  if (location?.kind === "wsl") {
    const home = overrides.CLAUDE_CONFIG_DIR ? undefined : resolveWslHomeDirectory(location.distro);
    const directory =
      overrides.CLAUDE_CONFIG_DIR ?? (home ? posix.join(home, ".claude") : undefined);
    if (directory)
      settingsPath = toWslUncPath(location.distro, posix.join(directory, "settings.json"));
  } else {
    settingsPath = join(
      overrides.CLAUDE_CONFIG_DIR ?? process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"),
      "settings.json",
    );
  }
  let configuredEntrypoint: string | undefined;
  if (settingsPath) {
    try {
      const parsed = settingsSchema.safeParse(JSON.parse(readFileSync(settingsPath, "utf8")));
      if (parsed.success) configuredEntrypoint = parsed.data.env?.CLAUDE_CODE_ENTRYPOINT;
    } catch {
      // Missing or malformed optional settings cannot prevent launching Claude.
    }
  }
  return {
    ...overrides,
    CLAUDE_CODE_ENTRYPOINT:
      configuredEntrypoint ?? (overrides.CLAUDE_CODE_ENTRYPOINT?.trim() || "orzi-code"),
  };
}
