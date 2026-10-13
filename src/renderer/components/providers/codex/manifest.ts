import { msg } from "@lingui/core/macro";
import type { RendererProviderManifest } from "../providerManifest";
import { formatFileCitationMarkdown } from "./fileCitationMarkdown";

export default {
  kind: "codex",
  label: msg`Codex`,
  order: 20,
  utilityOrder: 10,
  collapsedUsage: { windowIds: ["session-5h", "weekly"] },
  formatTranscriptMarkdown: formatFileCitationMarkdown,
} satisfies RendererProviderManifest;
