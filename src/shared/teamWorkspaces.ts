import { z } from "zod";

export const teamWorkspaceSummarySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("workspace"),
    runId: z.string(),
    path: z.string(),
    parentRoot: z.string(),
    state: z.enum(["active", "integrated", "retained"]),
  }),
  z.object({ kind: z.literal("invalid"), runId: z.string(), error: z.string() }),
]);
export type TeamWorkspaceSummary = z.infer<typeof teamWorkspaceSummarySchema>;
export const cleanupTeamWorkspacePayloadSchema = z.object({
  runId: z.string().regex(/^[a-f0-9]{12}$/),
  discardChanges: z.boolean().default(false),
});
export type CleanupTeamWorkspacePayload = z.infer<typeof cleanupTeamWorkspacePayloadSchema>;
