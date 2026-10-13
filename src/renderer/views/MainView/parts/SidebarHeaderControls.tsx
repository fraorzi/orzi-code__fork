import { FolderPlus, PanelLeftClose, Search } from "lucide-react";
import { Button, Tooltip } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { usePanelStore } from "@/renderer/state/panelStore";
import { useSidebar } from "@/renderer/views/MainView/parts/AppShell/AppShell";
import { AppUpdateButton } from "./AppUpdateButton";
import { CreateProjectMenu } from "./CreateProject/CreateProjectMenu";

export function SidebarHeaderControls() {
  const { t } = useLingui();
  const { collapse } = useSidebar();

  return (
    <div className="poracode-overlay-header__controls flex grow-[999] items-center justify-end gap-0.5">
      <AppUpdateButton />
      <CreateProjectMenu>
        <Tooltip delay={150}>
          <Button
            isIconOnly
            aria-label={t`Add project`}
            size="sm"
            variant="ghost"
            className="size-[26px] min-w-0 rounded-[6px] text-muted hover:text-foreground"
          >
            <FolderPlus className="size-4" />
          </Button>
          <Tooltip.Content placement="bottom">
            <Trans>Add project</Trans>
          </Tooltip.Content>
        </Tooltip>
      </CreateProjectMenu>
      <Tooltip delay={150}>
        <Tooltip.Trigger>
          <Button
            isIconOnly
            aria-label={t`Hide sidebar`}
            size="sm"
            variant="ghost"
            className="size-[26px] min-w-0 rounded-[6px] text-muted hover:text-foreground"
            onPress={collapse}
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content placement="bottom">
          <Trans>Hide sidebar</Trans>
        </Tooltip.Content>
      </Tooltip>
      <Tooltip delay={150}>
        <Tooltip.Trigger>
          <Button
            isIconOnly
            aria-label={t`Search`}
            size="sm"
            variant="ghost"
            className="size-[26px] min-w-0 rounded-[6px] text-muted hover:text-foreground"
            onPress={() => usePanelStore.getState().openThreadSearch()}
          >
            <Search className="size-4" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content placement="bottom">
          <Trans>Search</Trans>
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}
