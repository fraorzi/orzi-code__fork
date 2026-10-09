import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@/renderer/components/common";
import { isRemoteSession, readBridge } from "@/renderer/bridge";
import { useAppStore } from "@/renderer/state/appStore";
import type {
  HistoryImportFailure,
  HistoryImportPreview,
  HistoryImportReport,
} from "@/shared/historyImport";
import { SettingRow } from "./SettingsForm";

type ImportState =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "review" | "importing"; preview: HistoryImportPreview }
  | { kind: "success"; report: HistoryImportReport }
  | { kind: "error"; reason: HistoryImportFailure };

export function HistoryImportSection() {
  const { t } = useLingui();
  const [state, setState] = useState<ImportState>({ kind: "idle" });
  const token =
    state.kind === "review" || state.kind === "importing" ? state.preview.token : undefined;
  useEffect(
    () => () => {
      if (token)
        void readBridge()
          .cancelHistoryImport({ token })
          .catch(() => {});
    },
    [token],
  );

  function failureMessage(reason: HistoryImportFailure): string {
    switch (reason) {
      case "busy":
        return t`Another history import is running. Try again when it finishes.`;
      case "sameDatabase":
        return t`Choose a database from another profile.`;
      case "unsupportedDatabase":
        return t`This history database is invalid or uses an unsupported version.`;
      case "missingAttachment":
        return t`An attachment is missing or outside the source profile. Restore it before importing.`;
      case "stalePreview":
        return t`The history changed. Choose the source again to refresh the preview.`;
      case "operationFailed":
        return t`Could not import history. Your existing history is preserved.`;
      default: {
        const exhaustive: never = reason;
        return exhaustive;
      }
    }
  }

  async function chooseSource() {
    setState({ kind: "preparing" });
    try {
      const paths = await readBridge().pickFiles({
        title: t`Choose history database`,
        filters: [{ name: t`History database`, extensions: ["sqlite", "db"] }],
      });
      const sourcePath = paths?.[0];
      if (!sourcePath) {
        setState({ kind: "idle" });
        return;
      }
      const result = await readBridge().prepareHistoryImport({ sourcePath });
      setState(
        result.ok
          ? { kind: "review", preview: result.value }
          : { kind: "error", reason: result.reason },
      );
    } catch {
      setState({ kind: "error", reason: "operationFailed" });
    }
  }

  async function apply(preview: HistoryImportPreview) {
    setState({ kind: "importing", preview });
    let committed: HistoryImportReport | undefined;
    try {
      const result = await readBridge().applyHistoryImport({ token: preview.token });
      if (!result.ok) {
        setState({ kind: "error", reason: result.reason });
        return;
      }
      committed = result.value;
      const [projects, threads] = await Promise.all([
        readBridge().dbGetProjects(),
        readBridge().dbGetThreads(),
      ]);
      // Preserve live renderer state. Only imported rows absent from this store
      // are merged; main protects them against snapshots queued before import.
      useAppStore.setState((current) => ({
        projects: [
          ...current.projects,
          ...projects.filter(
            (project) => !current.projects.some((existing) => existing.id === project.id),
          ),
        ],
        threads: [
          ...current.threads,
          ...threads.filter(
            (thread) => !current.threads.some((existing) => existing.id === thread.id),
          ),
        ],
      }));
      setState({ kind: "success", report: result.value });
    } catch {
      setState(
        committed
          ? { kind: "success", report: committed }
          : { kind: "error", reason: "operationFailed" },
      );
    }
  }

  if (isRemoteSession()) return null;
  return (
    <section data-testid="history-import" className="space-y-3">
      <SettingRow
        anchorId="threads.historyImport"
        title={t`Import history`}
        description={
          <Trans>
            Existing threads are kept. Only new threads are added. Account settings and credentials
            are not imported.
          </Trans>
        }
      >
        <Button
          variant="secondary"
          size="sm"
          isDisabled={state.kind === "preparing" || state.kind === "importing"}
          onPress={() => void chooseSource()}
        >
          <Trans>Choose history database</Trans>
        </Button>
      </SettingRow>
      {state.kind === "review" || state.kind === "importing" ? (
        <div className="space-y-3 rounded-md border border-border p-3 text-xs">
          <p className="break-all text-muted">{state.preview.sourcePath}</p>
          <dl className="grid grid-cols-2 gap-2">
            <dt>
              <Trans>New projects</Trans>
            </dt>
            <dd>{state.preview.newProjects}</dd>
            <dt>
              <Trans>New threads</Trans>
            </dt>
            <dd>{state.preview.newThreads}</dd>
            <dt>
              <Trans>Existing threads skipped</Trans>
            </dt>
            <dd>{state.preview.skippedThreads}</dd>
            <dt>
              <Trans>Attachments</Trans>
            </dt>
            <dd>{state.preview.attachments}</dd>
          </dl>
          <p className="text-muted">
            <Trans>A backup is saved before importing. Imported threads start inactive.</Trans>
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              isDisabled={state.kind === "importing"}
              onPress={() => setState({ kind: "idle" })}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              size="sm"
              isPending={state.kind === "importing"}
              isDisabled={
                state.kind === "importing" ||
                (state.preview.newThreads === 0 && state.preview.newProjects === 0)
              }
              onPress={() => void apply(state.preview)}
            >
              <Trans>Import new threads</Trans>
            </Button>
          </div>
        </div>
      ) : state.kind === "error" ? (
        <p role="alert" className="text-xs text-danger">
          {failureMessage(state.reason)}
        </p>
      ) : state.kind === "success" ? (
        <div role="status" className="space-y-1 text-xs">
          <p>
            <Trans>History imported.</Trans>
          </p>
          <p className="break-all text-muted">
            <Trans>Backup saved at</Trans>: {state.report.backupPath}
          </p>
        </div>
      ) : null}
    </section>
  );
}
