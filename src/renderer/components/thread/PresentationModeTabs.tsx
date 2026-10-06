// Modified for the orzi-code__fork personal fork by Franciszek Orzechowski on 2026-10-06.
import { Button, Dropdown, Label } from "@heroui/react";
import { MessageSquare, Settings2, TerminalSquare } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { ThreadPresentationMode } from "@/shared/contracts";

export interface PresentationModeTabsProps {
  presentationMode: ThreadPresentationMode;
  onChange: (next: ThreadPresentationMode) => void;
  supportsTerminal: boolean;
  supportsGui: boolean;
  className?: string;
}

export function PresentationModeTabs(props: PresentationModeTabsProps) {
  const { t } = useLingui();
  return (
    <Dropdown>
      <Button size="sm" variant="ghost" className={props.className ?? ""} aria-label={t`Advanced`}>
        <Settings2 className="size-3.5" />
        {props.presentationMode === "terminal" ? t`CLI` : t`Advanced`}
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label={t`Thread mode`}
          selectionMode="single"
          selectedKeys={[props.presentationMode]}
          onAction={(key) => {
            if (key === "gui" || key === "terminal") props.onChange(key);
          }}
        >
          <Dropdown.Item id="gui" textValue={t`Chat`} isDisabled={!props.supportsGui}>
            <MessageSquare className="size-3.5" />
            <Label>{t`Chat`}</Label>
            <Dropdown.ItemIndicator />
          </Dropdown.Item>
          <Dropdown.Item id="terminal" textValue={t`CLI`} isDisabled={!props.supportsTerminal}>
            <TerminalSquare className="size-3.5" />
            <Label>{t`CLI`}</Label>
            <Dropdown.ItemIndicator />
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
