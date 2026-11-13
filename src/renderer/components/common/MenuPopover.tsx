import type { ComponentProps, ReactNode } from "react";
import { Popover } from "@heroui/react";

type Placement = ComponentProps<typeof Popover.Content>["placement"];

/** Shared desktop menu popover with deferred dialog mounting. */
export function MenuPopover(props: {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly trigger: ReactNode;
  readonly children: ReactNode | (() => ReactNode);
  readonly label: string;
  readonly placement?: Placement;
  readonly contentClassName?: string;
  readonly dialogClassName?: string;
  readonly triggerClassName?: string;
}) {
  return (
    <Popover isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
      <Popover.Trigger {...(props.triggerClassName ? { className: props.triggerClassName } : {})}>
        {props.trigger}
      </Popover.Trigger>
      {props.isOpen ? (
        <Popover.Content
          placement={props.placement ?? "top start"}
          {...(props.contentClassName ? { className: props.contentClassName } : {})}
        >
          <Popover.Dialog {...(props.dialogClassName ? { className: props.dialogClassName } : {})}>
            {typeof props.children === "function" ? props.children() : props.children}
          </Popover.Dialog>
        </Popover.Content>
      ) : null}
    </Popover>
  );
}
