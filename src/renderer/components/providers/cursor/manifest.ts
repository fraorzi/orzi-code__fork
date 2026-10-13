import { msg } from "@lingui/core/macro";
import type { RendererProviderManifest } from "../providerManifest";

export default {
  kind: "cursor",
  label: msg`Cursor`,
  order: 30,
  utilityOrder: 80,
  collapsedUsage: { windowIds: ["cursor-api"], remainingMoney: true },
} satisfies RendererProviderManifest;
