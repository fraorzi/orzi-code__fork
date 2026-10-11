import { Plus } from "lucide-react";
import { Button } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { CreateProjectMenu } from "@/renderer/views/MainView/parts/CreateProject/CreateProjectMenu";
import { SidebarListOptionsMenu } from "./SidebarListOptionsMenu";

export function SidebarProjectsHeading() {
  const { t } = useLingui();
  const revealClass =
    "opacity-0 group-hover/projects-heading:opacity-100 focus-visible:opacity-100 data-[pressed]:opacity-100 aria-expanded:opacity-100";

  return (
    <div className="group/projects-heading flex h-[26px] items-center gap-0.5 px-2 text-[11px] font-medium tracking-[0.02em] text-muted/70">
      <span className="min-w-0 flex-1 truncate">
        <Trans>Projects</Trans>
      </span>
      <SidebarListOptionsMenu className={revealClass} />
      <CreateProjectMenu>
        <Button
          isIconOnly
          aria-label={t`Add project`}
          size="sm"
          variant="ghost"
          className={`size-[22px] min-w-0 rounded-[6px] text-muted hover:text-foreground ${revealClass}`}
        >
          <Plus className="size-3.5" />
        </Button>
      </CreateProjectMenu>
    </div>
  );
}
