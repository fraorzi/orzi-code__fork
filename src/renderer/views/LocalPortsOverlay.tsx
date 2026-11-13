import { useEffect, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { ExternalLink, RefreshCw, Square } from "lucide-react";
import type { LocalPort, LocalPortsResult, StopLocalPortResult } from "@/shared/localPorts";
import { readBridge } from "@/renderer/bridge";
import { useAppStore } from "@/renderer/state/appStore";
import { useLocalPortsStore } from "@/renderer/state/localPortsStore";

export function LocalPortsOverlay() {
  const open = useLocalPortsStore((s) => s.open);
  const [revision, setRevision] = useState(0);
  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(next) => useLocalPortsStore.getState().setOpen(next)}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[640px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>
              <Trans>Ports</Trans>
            </Modal.Heading>
          </Modal.Header>
          {open ? (
            <LocalPortsBody key={revision} onRefresh={() => setRevision((value) => value + 1)} />
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function LocalPortsBody({ onRefresh }: { onRefresh(): void }) {
  const { t } = useLingui();
  const [result, setResult] = useState<LocalPortsResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      let next: LocalPortsResult;
      try {
        next = await readBridge().listLocalPorts();
      } catch {
        next = { status: "unavailable", reason: "scan-failed" };
      }
      if (cancelled) return;
      setResult(next);
      timer = setTimeout(() => void poll(), 3000);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <Modal.Body className="max-h-[60vh] overflow-y-auto p-4">
        <p className="mb-3 text-xs text-muted">
          <Trans>
            Local TCP servers started by agents or terminals in this app. Stopping a server closes
            all ports of its process.
          </Trans>
        </p>
        {result === null ? (
          <p className="text-sm text-muted">{t`Scanning ports...`}</p>
        ) : result.status === "unavailable" ? (
          <p role="status" className="text-sm text-muted">
            {result.reason === "unsupported-platform"
              ? t`Port management is available for native macOS and Linux processes.`
              : t`Unable to inspect local ports. Check that lsof is available.`}
          </p>
        ) : result.ports.length === 0 ? (
          <p role="status" className="py-5 text-center text-sm text-muted">
            <Trans>No running servers found.</Trans>
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-separator">
            {result.ports.map((port) => (
              <LocalPortRow
                key={`${port.pid}:${port.startedAt}:${port.port}`}
                port={port}
                onStopped={onRefresh}
              />
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={onRefresh}>
          <RefreshCw className="size-3.5" />
          <Trans>Refresh</Trans>
        </Button>
        <Button slot="close" variant="tertiary">
          <Trans>Close</Trans>
        </Button>
      </Modal.Footer>
    </>
  );
}

function LocalPortRow({ port, onStopped }: { port: LocalPort; onStopped(): void }) {
  const { t } = useLingui();
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<
    Extract<StopLocalPortResult, { status: "error" }>["reason"] | null
  >(null);
  const projectName = useAppStore(
    (s) =>
      s.projects
        .flatMap((project) =>
          project.location.kind === "posix" &&
          !project.location.remoteServerId &&
          (port.cwd === project.location.path || port.cwd.startsWith(`${project.location.path}/`))
            ? [{ name: project.name, path: project.location.path }]
            : [],
        )
        .sort((a, b) => b.path.length - a.path.length)[0]?.name,
  );
  const host =
    port.address === "*" || port.address === "0.0.0.0"
      ? "localhost"
      : port.address === "[::]"
        ? "[::1]"
        : port.address;
  const url = `http://${host}:${port.port}`;
  const stop = async () => {
    setStopping(true);
    try {
      const result = await readBridge().stopLocalPort({
        pid: port.pid,
        startedAt: port.startedAt,
        port: port.port,
        ...(error === "still-running" ? { force: true } : {}),
      });
      if (result.status === "stopped" || result.reason === "stale") onStopped();
      else setError(result.reason);
    } catch {
      setError("failed");
    } finally {
      setStopping(false);
    }
  };
  const errorText =
    error === "still-running"
      ? t`The server did not stop. You can force stop it.`
      : error === "permission-denied"
        ? t`This process cannot be stopped with your current permissions.`
        : error === "protected"
          ? t`This process is no longer owned by this app.`
          : error
            ? t`Unable to stop the server.`
            : null;
  return (
    <div className="flex flex-col gap-1 py-3" data-local-port={port.port}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-sm">{url}</span>
        <Button
          size="sm"
          variant="ghost"
          aria-label={t`Open ${url}`}
          onPress={() => {
            void readBridge().openExternal(url);
          }}
        >
          <ExternalLink className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="danger"
          isDisabled={stopping}
          onPress={() => {
            void stop();
          }}
        >
          <Square className="size-3" />
          {stopping ? t`Stopping...` : error === "still-running" ? t`Force stop` : t`Stop`}
        </Button>
      </div>
      <p className="truncate text-xs text-muted">
        {port.processName} · {port.pid}
        {projectName ? ` · ${projectName}` : ""}
      </p>
      {port.cwd ? (
        <p className="truncate font-mono text-[11px] text-muted" title={port.cwd}>
          {port.cwd}
        </p>
      ) : null}
      {errorText ? (
        <p role="alert" className="text-xs text-danger">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
