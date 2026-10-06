import { z } from "zod";
import {
  normalizeCrossagentTags,
  removeCrossagentRoutingOverride,
  upsertCrossagentRoutingOverride,
} from "./crossagentRanking";
import {
  crossagentRoutingOverrideSchema,
  MAX_CROSSAGENT_ROUTING_OVERRIDES,
  type CrossagentRoutingOverride,
} from "./settings";

export const saveCrossagentRolePayloadSchema = z.object({
  override: crossagentRoutingOverrideSchema.omit({ updatedAt: true }),
  previousTags: z.array(z.string().min(1).max(32)).min(1).max(5).optional(),
});
export type SaveCrossagentRolePayload = z.infer<typeof saveCrossagentRolePayloadSchema>;

/** Replace a role atomically, rejecting tag collisions instead of losing another route. */
export function saveCrossagentRole(
  entries: readonly CrossagentRoutingOverride[],
  payload: SaveCrossagentRolePayload,
  now = Date.now(),
): CrossagentRoutingOverride[] {
  const tags = normalizeCrossagentTags(payload.override.tags);
  if (tags.length === 0) throw new Error("A role requires at least one task tag");
  const previous = payload.previousTags ? normalizeCrossagentTags(payload.previousTags) : undefined;
  if (
    previous &&
    !entries.some((entry) => normalizeCrossagentTags(entry.tags).join("\0") === previous.join("\0"))
  ) {
    throw new Error("The role was removed; reopen the editor");
  }
  const remaining = previous ? removeCrossagentRoutingOverride(entries, previous) : [...entries];
  if (
    remaining.some((entry) => normalizeCrossagentTags(entry.tags).join("\0") === tags.join("\0"))
  ) {
    throw new Error("A role with these task tags already exists");
  }
  if (remaining.length >= MAX_CROSSAGENT_ROUTING_OVERRIDES)
    throw new Error("The role limit has been reached");
  return upsertCrossagentRoutingOverride(remaining, { ...payload.override, tags, updatedAt: now });
}
