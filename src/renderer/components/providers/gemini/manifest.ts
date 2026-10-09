import { msg } from "@lingui/core/macro";
import type { RendererProviderManifest } from "../providerManifest";

export default {
  kind: "gemini",
  label: msg`Gemini`,
  order: 32,
  utilityOrder: 30,
} satisfies RendererProviderManifest;
