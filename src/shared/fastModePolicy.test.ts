import { describe, expect, it } from "vitest";
import { threadConfigSchema } from "./contracts/config";
import { providerModelPreferenceSchema, crossagentRoutingSelectionSchema } from "./settings";
import { modelSelectionFor } from "./agentSelection";
import { agentCapabilitySchema } from "./contracts/agent";

describe("personal fork fast-mode policy", () => {
  it("migrates old thread, preference and team opt-ins without losing other settings", () => {
    expect(threadConfigSchema.parse({ model: "model", effort: "high", fast: true })).toEqual({
      model: "model",
      effort: "high",
      fast: false,
    });
    expect(providerModelPreferenceSchema.parse({ effort: "high", fast: true })).toEqual({
      effort: "high",
      fast: false,
    });
    expect(crossagentRoutingSelectionSchema.parse({ agentKind: "provider", fast: true }).fast).toBe(
      false,
    );
  });
  it("hides priority mode even when a cached provider advertises it", () => {
    const capabilities = agentCapabilitySchema.parse({ fastModels: ["model"] });
    expect(modelSelectionFor(capabilities, "model").fast).toEqual({
      supported: false,
      available: false,
    });
  });
});
