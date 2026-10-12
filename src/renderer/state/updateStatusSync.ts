import { toast } from "@heroui/react";
import { msg as linguiMsg } from "@lingui/core/macro";
import { i18n } from "@/renderer/i18n/i18n";
import { readBridge } from "@/renderer/bridge";
import { msg } from "@/shared/messages";
import type { UpdateStatus } from "@/shared/ipc";
import { useUpdateStore } from "./updateStore";

let updateToastId: string | undefined;
let lastUpdateToastBuild: string | undefined;

function handleUpdateStatus(status: UpdateStatus, notifyError = true): void {
  const store = useUpdateStore.getState();
  switch (status.type) {
    case "checking":
      store.setChecking();
      break;
    case "update-available":
      store.beginUpdateDownload(status.version);
      break;
    case "update-not-available":
      store.setNotAvailable();
      break;
    case "downloading":
      store.setDownloading(status.percent, {
        transferred: status.transferred,
        total: status.total,
        bytesPerSecond: status.bytesPerSecond,
      });
      break;
    case "downloaded":
      store.setDownloaded(status.version);
      if (lastUpdateToastBuild !== (status.buildId ?? status.version)) {
        if (updateToastId !== undefined) toast.close(updateToastId);
        lastUpdateToastBuild = status.buildId ?? status.version;
        updateToastId = toast(i18n._(linguiMsg`Update ready`), {
          timeout: 0,
          actionProps: {
            children: i18n._(linguiMsg`Update and restart`),
            onPress: () => void readBridge().installUpdate(),
          },
        });
      }
      break;
    case "error": {
      const detail = status.messageKey ? msg(status.messageKey) : status.message;
      store.setError(detail);
      if (notifyError) toast.danger(msg("update.error", { detail }));
      break;
    }
  }
}

export function installUpdateStatusSync(
  bridge: Pick<ReturnType<typeof readBridge>, "getUpdateStatus" | "onUpdateStatus"> = readBridge(),
): () => void {
  let disposed = false;
  let receivedLiveStatus = false;
  const unsubscribe = bridge.onUpdateStatus((status) => {
    receivedLiveStatus = true;
    handleUpdateStatus(status);
  });
  void bridge
    .getUpdateStatus()
    .then((status) => {
      if (!disposed && !receivedLiveStatus && status) handleUpdateStatus(status, false);
    })
    .catch((error: unknown) => {
      if (!disposed) console.error("[poracode][updates] get-update-status failed", error);
    });
  return () => {
    disposed = true;
    unsubscribe();
  };
}
