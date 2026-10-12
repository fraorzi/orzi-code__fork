import { z } from "zod";

/** Mirrored by resources/local-update/install.py. Reject unknown installer generations. */
export const LOCAL_UPDATE_MANIFEST_VERSION = 1;
export const localUpdateManifestSchema = z.object({
  version: z.literal(LOCAL_UPDATE_MANIFEST_VERSION),
  bundlePath: z.string().min(1),
  appId: z.string().min(1),
  appVersion: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.number().int().positive(),
});
export type LocalUpdateManifest = z.infer<typeof localUpdateManifestSchema>;
