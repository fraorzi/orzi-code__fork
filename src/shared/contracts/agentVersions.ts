import { z } from "zod";
import { agentKindSchema } from "./common";

export const exactAgentVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/);
export const getAgentVersionsPayloadSchema = z.object({ agentKind: agentKindSchema });
export type GetAgentVersionsPayload = z.infer<typeof getAgentVersionsPayloadSchema>;
export const manageAgentVersionPayloadSchema = z.discriminatedUnion("action", [
  z.object({
    agentKind: agentKindSchema,
    action: z.literal("install"),
    version: exactAgentVersionSchema,
  }),
  z.object({ agentKind: agentKindSchema, action: z.literal("rollback") }),
  z.object({ agentKind: agentKindSchema, action: z.literal("system") }),
]);
export type ManageAgentVersionPayload = z.infer<typeof manageAgentVersionPayloadSchema>;
export const agentVersionsStateSchema = z.discriminatedUnion("supported", [
  z.object({ supported: z.literal(false) }),
  z.object({
    supported: z.literal(true),
    active: exactAgentVersionSchema.optional(),
    previous: exactAgentVersionSchema.optional(),
    error: z.string().optional(),
  }),
]);
export type AgentVersionsState = z.infer<typeof agentVersionsStateSchema>;
export type ManageAgentVersionResult = { ok: boolean; state: AgentVersionsState; error?: string };
