import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { toast } from "@heroui/react";
import { isRemoteSession, readBridge } from "@/renderer/bridge";
import { Button, ConfirmDialog } from "@/renderer/components/common";
import type { TeamWorkspaceSummary } from "@/shared/teamWorkspaces";

export function TeamWorkspacesSection() {
  const { t } = useLingui();
  const [workspaces, setWorkspaces] = useState<TeamWorkspaceSummary[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<string | null>(null);
  useEffect(() => {
    if (isRemoteSession()) return;
    let active = true;
    readBridge()
      .getTeamWorkspaces()
      .then((saved) => {
        if (active) setWorkspaces(saved);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      setWorkspaces(await readBridge().getTeamWorkspaces());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function remove(runId: string, discardChanges: boolean) {
    setRemoving(runId);
    setDiscarding(null);
    try {
      await readBridge().cleanupTeamWorkspace({ runId, discardChanges });
      await refresh();
    } catch {
      toast.danger(t`Unable to remove team workspace.`);
    } finally {
      setRemoving(null);
    }
  }

  if (isRemoteSession()) return null;
  return (
    <section className="space-y-2" data-testid="team-workspaces">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          <Trans>Saved team workspaces</Trans>
        </p>
        <Button
          size="sm"
          variant="ghost"
          isDisabled={loading || removing !== null}
          onPress={() => void refresh()}
        >
          <Trans>Refresh</Trans>
        </Button>
      </div>
      <p className="text-xs text-muted">
        <Trans>
          Remove finished workspaces to free disk space. Interrupted tasks can be resumed by the
          lead agent in their original thread.
        </Trans>
      </p>
      {failed ? (
        <p className="text-xs text-danger">
          <Trans>Unable to load team workspaces.</Trans>
        </p>
      ) : !loading && workspaces.length === 0 ? (
        <p className="text-xs text-muted">
          <Trans>No saved team workspaces.</Trans>
        </p>
      ) : null}
      {workspaces.map((workspace) => (
        <div
          key={workspace.runId}
          className="flex items-center justify-between gap-3 border-b border-border py-2"
        >
          <div className="min-w-0 text-xs">
            <p className="truncate font-mono">
              {workspace.kind === "workspace" ? workspace.parentRoot : workspace.runId}
            </p>
            <p className="text-muted">
              {workspace.kind === "invalid"
                ? t`Unreadable workspace`
                : workspace.state === "active"
                  ? t`Active`
                  : workspace.state === "integrated"
                    ? t`Integrated`
                    : t`Unintegrated`}
            </p>
          </div>
          {workspace.kind === "workspace" ? (
            <Button
              size="sm"
              variant="ghost"
              isDisabled={workspace.state === "active" || removing !== null}
              onPress={() =>
                workspace.state === "integrated"
                  ? void remove(workspace.runId, false)
                  : setDiscarding(workspace.runId)
              }
            >
              <Trans>Remove</Trans>
            </Button>
          ) : null}
        </div>
      ))}
      <ConfirmDialog
        isOpen={discarding !== null}
        title={t`Discard unintegrated work?`}
        body={
          <Trans>
            This removes the worker's saved files and its recovery data. Changes already integrated
            into your project are kept.
          </Trans>
        }
        confirmLabel={t`Discard workspace`}
        onConfirm={() => {
          if (discarding) void remove(discarding, true);
        }}
        onClose={() => setDiscarding(null)}
      />
    </section>
  );
}
