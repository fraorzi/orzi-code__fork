import { useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Label, ListBox, ListLayout, Tooltip, Virtualizer, Selection } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { Button, type ButtonProps } from "./Button";
import { MenuPopover } from "./MenuPopover";
import {
  LARGE_DROPDOWN_VIRTUALIZATION_THRESHOLD,
  MENU_DROPDOWN_ROW_HEIGHT,
  VIRTUALIZED_MENU_DROPDOWN_ITEM_CLASS,
} from "./dropdownVirtualization";
export interface OptionMenuProps {
  value: string;
  options: readonly (
    | string
    | {
        id: string;
        label: string;
        icon?: ReactNode;
        hint?: string;
      }
  )[];
  onChange: (value: string) => void;
  icon?: ReactNode;
  placeholder?: string;
  isDisabled?: boolean;
  className?: string;
  buttonVariant?: ButtonProps["variant"];
  hideLabelOnWrap?: boolean;
  forceHideLabel?: boolean;
  collapseTier?: number;
  iconOnly?: boolean;
  tooltip?: string | undefined;
  onOpenChange?: (open: boolean) => void;
}
export function OptionMenu(props: OptionMenuProps) {
  const { t } = useLingui();
  const {
    value,
    options,
    onChange,
    icon,
    placeholder,
    isDisabled = false,
    className,
    buttonVariant = "secondary",
    hideLabelOnWrap = false,
    forceHideLabel = false,
    collapseTier,
    iconOnly = false,
    tooltip,
    onOpenChange,
  } = props;
  const resolvedPlaceholder = placeholder ?? t`Select`;
  const [isOpen, setIsOpen] = useState(false);
  const normalizedOptions = options.map((option) =>
    typeof option === "string"
      ? {
          id: option,
          label: option,
          icon: undefined,
          hint: undefined,
        }
      : option,
  );
  const currentValue =
    normalizedOptions.find((option) => option.id === value)?.label || value || resolvedPlaceholder;
  const effectiveTooltip = tooltip ?? (hideLabelOnWrap || iconOnly ? currentValue : undefined);
  const buttonProps = className
    ? {
        className,
      }
    : {};
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };
  const button = (
    <Button
      aria-label={resolvedPlaceholder}
      isDisabled={isDisabled || normalizedOptions.length === 0}
      size="sm"
      variant={buttonVariant}
      {...buttonProps}
    >
      {icon}
      {!iconOnly && (
        <span
          data-collapse-tier={collapseTier}
          className={
            hideLabelOnWrap
              ? `poracode-composer-label-hideable truncate${forceHideLabel ? " is-hidden" : ""}`
              : "truncate"
          }
        >
          {currentValue}
        </span>
      )}
      {!iconOnly && (
        <ChevronDown
          data-collapse-tier={collapseTier}
          className={
            hideLabelOnWrap
              ? `poracode-composer-label-hideable size-3.5 text-muted${forceHideLabel ? " is-hidden" : ""}`
              : "size-3.5 text-muted"
          }
        />
      )}
    </Button>
  );
  const selectedKeys = value ? new Set([value]) : new Set<string>();
  const isVirtualized = normalizedOptions.length > LARGE_DROPDOWN_VIRTUALIZATION_THRESHOLD;
  const listBoxClassName = isVirtualized
    ? `poracode-menu max-h-60 overflow-y-auto ${VIRTUALIZED_MENU_DROPDOWN_ITEM_CLASS}`
    : "poracode-menu max-h-60 overflow-y-auto";
  const listBox = (
    <ListBox
      aria-label={t`Options`}
      className={listBoxClassName}
      items={normalizedOptions}
      selectedKeys={selectedKeys}
      selectionMode="single"
      disallowEmptySelection
      onSelectionChange={(keys: Selection) => {
        if (keys === "all") return;
        const selected = [...keys][0];
        if (selected !== undefined) {
          handleOpenChange(false);
          onChange(String(selected));
        }
      }}
    >
      {(option) => (
        <ListBox.Item
          id={option.id}
          textValue={option.label}
          className="focus-visible:outline-none"
        >
          <ListBox.ItemIndicator />
          {option.icon}
          <Label className="flex-1 truncate">{option.label}</Label>
          {option.hint && (
            <span className="ms-auto truncate text-xs text-muted">{option.hint}</span>
          )}
        </ListBox.Item>
      )}
    </ListBox>
  );
  const desktopTrigger = effectiveTooltip ? (
    <Tooltip>
      {button}
      <Tooltip.Content placement="top">{effectiveTooltip}</Tooltip.Content>
    </Tooltip>
  ) : (
    button
  );
  return (
    <MenuPopover
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      label={resolvedPlaceholder}
      trigger={desktopTrigger}
      placement="top"
      contentClassName="p-0"
      dialogClassName="overflow-hidden"
    >
      {isVirtualized ? (
        <Virtualizer
          layout={ListLayout}
          layoutOptions={{
            padding: 4,
            rowHeight: MENU_DROPDOWN_ROW_HEIGHT,
          }}
        >
          {listBox}
        </Virtualizer>
      ) : (
        listBox
      )}
    </MenuPopover>
  );
}
