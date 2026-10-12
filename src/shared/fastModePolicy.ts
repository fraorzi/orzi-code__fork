import { z } from "zod";

/** Personal fork policy: legacy opt-ins are accepted, but never enable priority billing. */
export const fastModeSchema = z.boolean().transform((): boolean => false);
