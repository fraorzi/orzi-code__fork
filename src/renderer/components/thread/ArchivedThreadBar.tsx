import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { restoreArchivedThread } from "@/renderer/actions/threadActions";

export function ArchivedThreadBar(props: { threadId: string }) {
  return (
    <div className="mx-auto mb-3 flex w-full shrink-0 items-center gap-2 rounded-[10px] border border-[var(--hairline-strong)] bg-[var(--composer-surface)] px-3 py-2 text-[13px] text-muted">
      <Archive className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        <Trans>Archived thread. Restore it to continue the conversation.</Trans>
      </span>
      <Button size="sm" variant="secondary" onPress={() => restoreArchivedThread(props.threadId)}>
        <ArchiveRestore className="size-3.5" />
        <Trans>Restore</Trans>
      </Button>
    </div>
  );
}
