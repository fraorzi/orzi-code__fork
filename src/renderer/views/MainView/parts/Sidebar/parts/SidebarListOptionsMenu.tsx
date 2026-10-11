import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { useLingui } from "@lingui/react/macro";
import { usePanelStore } from "@/renderer/state/panelStore";
import {
  type ThreadSortMode,
  listLayoutIcon,
  listLayoutLabel,
  listLayoutOrder,
  sortModeOrder,
  sortModeIcon,
  sortModeLabel,
} from "./sortMode";

export function SidebarListOptionsMenu(props: { className?: string }) {
  const { t } = useLingui();
  const threadSortMode = usePanelStore((s) => s.threadSortMode);
  const threadListLayout = usePanelStore((s) => s.threadListLayout);

  return (
    <Dropdown>
      <Button
        isIconOnly
        aria-label={t`List options`}
        size="sm"
        variant="ghost"
        className={`size-[22px] min-w-0 rounded-[6px] text-muted hover:text-foreground ${props.className ?? ""}`}
      >
        {(() => {
          const Icon =
            threadListLayout === "flat" ? listLayoutIcon.flat : sortModeIcon[threadSortMode];
          return <Icon className="size-3.5" />;
        })()}
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu
          aria-label={t`Thread list options`}
          selectionMode="multiple"
          selectedKeys={[threadSortMode, threadListLayout]}
          onAction={(key) => {
            const state = usePanelStore.getState();
            if (key === "grouped" || key === "flat") state.setThreadListLayout(key);
            else state.setThreadSortMode(key as ThreadSortMode);
          }}
        >
          {sortModeOrder.map((mode) => {
            const Icon = sortModeIcon[mode];
            const label = t(sortModeLabel[mode]);
            return (
              <Dropdown.Item key={mode} id={mode} textValue={label}>
                <Icon className="size-4 shrink-0 text-muted" />
                <Label>{label}</Label>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            );
          })}
          <Separator />
          {listLayoutOrder.map((layout) => {
            const Icon = listLayoutIcon[layout];
            const label = t(listLayoutLabel[layout]);
            return (
              <Dropdown.Item key={layout} id={layout} textValue={label}>
                <Icon className="size-4 shrink-0 text-muted" />
                <Label>{label}</Label>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
