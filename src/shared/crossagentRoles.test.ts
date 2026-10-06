import { describe, expect, it } from "vitest";
import { saveCrossagentRole, saveCrossagentRolePayloadSchema } from "./crossagentRoles";
import { normalizeSharedSettings, type CrossagentRoutingOverride } from "./settings";

const legacy: CrossagentRoutingOverride = {
  tags: ["review"],
  agentKind: "worker",
  modelId: "strong",
  updatedAt: 1,
};

describe("worker roles", () => {
  it("reads pre-role settings without losing legacy routing preferences", () => {
    expect(
      normalizeSharedSettings({ crossagentRoutingOverrides: [legacy] }).crossagentRoutingOverrides,
    ).toEqual([legacy]);
  });
  it("renames task tags atomically and preserves other routes", () => {
    const payload = saveCrossagentRolePayloadSchema.parse({
      previousTags: ["review"],
      override: {
        ...legacy,
        tags: ["FE", "design"],
        name: " UI specialist ",
        instructions: " Check contrast ",
        fallbacks: [{ agentKind: "alternate", modelId: "fast" }],
      },
    });
    const next = saveCrossagentRole([legacy, { ...legacy, tags: ["testing"] }], payload, 5);
    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({
      name: "UI specialist",
      instructions: "Check contrast",
      tags: ["design", "frontend"],
      updatedAt: 5,
      fallbacks: [{ agentKind: "alternate", modelId: "fast" }],
    });
    expect(next[1]?.tags).toEqual(["testing"]);
  });
  it("rejects normalized tag collisions and stale edits without losing a route", () => {
    const routes = [legacy, { ...legacy, tags: ["frontend"] }];
    expect(() =>
      saveCrossagentRole(routes, {
        previousTags: ["review"],
        override: { ...legacy, tags: ["fe"] },
      }),
    ).toThrow("already exists");
    expect(() =>
      saveCrossagentRole(routes, { override: { ...legacy, tags: ["code-review"] } }),
    ).toThrow("already exists");
    expect(() => saveCrossagentRole(routes, { previousTags: ["gone"], override: legacy })).toThrow(
      "removed",
    );
    expect(routes).toHaveLength(2);
  });
  it("validates role metadata and fallback bounds at the IPC boundary", () => {
    expect(
      saveCrossagentRolePayloadSchema.safeParse({ override: { ...legacy, name: " " } }).success,
    ).toBe(false);
    expect(
      saveCrossagentRolePayloadSchema.safeParse({
        override: { ...legacy, instructions: "x".repeat(8001) },
      }).success,
    ).toBe(false);
    expect(
      saveCrossagentRolePayloadSchema.safeParse({
        override: {
          ...legacy,
          fallbacks: Array.from({ length: 4 }, () => ({ agentKind: "worker" })),
        },
      }).success,
    ).toBe(false);
  });
});
