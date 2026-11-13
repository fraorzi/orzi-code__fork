import { msg } from "@lingui/core/macro";
import type { RendererProviderManifest } from "../providerManifest";

export default {
  kind: "claude",
  label: msg`Claude Code`,
  order: 10,
  utilityOrder: 20,
  usageResetUrl: "https://claude.ai/settings/usage",
  usageResetBrowserLogin: true,
  collapsedUsage: { windowIds: ["session-5h", "weekly"] },
} satisfies RendererProviderManifest;
