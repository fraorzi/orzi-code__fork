import { SquarePen } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { openNewThread } from "@/renderer/actions/threadActions";
import { useCommandShortcutLabel } from "@/renderer/commands/commandShortcutLabel";
import { SidebarButton } from "@/renderer/components/common/SidebarButton";
import { useAppStore } from "@/renderer/state/appStore";

export function SidebarNewThreadRow() {
  const { t } = useLingui();
  const isDraftView = useAppStore((s) => s.view.kind === "draft");
  const shortcut = useCommandShortcutLabel("thread.new");

  return (
    <SidebarButton
      icon={<SquarePen className="size-4 shrink-0" />}
      label={<span className="text-foreground">{t`New thread`}</span>}
      isActive={isDraftView}
      onPress={() => openNewThread()}
      {...(shortcut
        ? { suffix: <span className="font-mono text-[11px] text-muted/70">{shortcut}</span> }
        : {})}
    />
  );
}
