import { z } from "zod";

export const historyImportTokenSchema = z.object({ token: z.uuid() });
export const historyImportSourceSchema = z.object({ sourcePath: z.string().min(1) });
export const historyImportFailureSchema = z.enum([
  "busy",
  "sameDatabase",
  "unsupportedDatabase",
  "missingAttachment",
  "stalePreview",
  "operationFailed",
]);
export type HistoryImportFailure = z.infer<typeof historyImportFailureSchema>;
export interface HistoryImportPreview {
  token: string;
  sourcePath: string;
  newProjects: number;
  newThreads: number;
  skippedThreads: number;
  attachments: number;
}
export interface HistoryImportReport {
  projects: number;
  threads: number;
  attachments: number;
  backupPath: string;
}
export type HistoryImportResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: HistoryImportFailure };
