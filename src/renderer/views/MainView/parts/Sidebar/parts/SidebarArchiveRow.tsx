import { Archive } from "lucide-react";
import { startTransition } from "react";
import { useLingui } from "@lingui/react/macro";
import { SidebarButton } from "@/renderer/components/common/SidebarButton";
import { useAppStore } from "@/renderer/state/appStore";
import { useArchivedThreadCount } from "./activeSidebarProjects";

export function SidebarArchiveRow() {
  const { t } = useLingui();
  const count = useArchivedThreadCount();
  const isActive = useAppStore((s) => s.view.kind === "archive");
  const openArchive = useAppStore((s) => s.openArchive);
  if (count === 0) return null;

  return (
    <SidebarButton
      icon={<Archive className="size-4 shrink-0" />}
      label={t`Archive`}
      isActive={isActive}
      onPress={() => startTransition(() => openArchive())}
      suffix={<span className="font-mono text-[11px] text-muted/70">{count}</span>}
    />
  );
}
