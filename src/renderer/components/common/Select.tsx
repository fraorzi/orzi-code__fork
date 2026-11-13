import { type ComponentProps, type ReactNode } from "react";
import {
  Description,
  Label,
  ListBox,
  ListLayout,
  Select as HeroSelect,
  type SelectProps as HeroSelectProps,
  Virtualizer,
} from "@heroui/react";
import {
  LARGE_DROPDOWN_VIRTUALIZATION_THRESHOLD,
  SELECT_DROPDOWN_ROW_HEIGHT,
} from "./dropdownVirtualization";
export interface SelectOption {
  id: string;
  label: string;
  icon?: ReactNode;
  detail?: string;
  /** Listed but not selectable (e.g. an offline remote machine). */
  isDisabled?: boolean;
}
export interface SelectProps extends Omit<
  HeroSelectProps<object, "single">,
  "children" | "onChange" | "value"
> {
  label?: string;
  options: readonly SelectOption[];
  value?: string | null;
  onChange: (value: string) => void;
  popoverProps?: Omit<ComponentProps<typeof HeroSelect.Popover>, "children">;
}
export function Select(props: SelectProps) {
  const { label, onChange, options, popoverProps, value, ...rest } = props;
  const selectedValue = value && options.some((option) => option.id === value) ? value : null;
  const selectedOption = options.find((option) => option.id === selectedValue);
  const isVirtualized = options.length > LARGE_DROPDOWN_VIRTUALIZATION_THRESHOLD;
  const disabledKeys = options.filter((option) => option.isDisabled).map((option) => option.id);
  const listBox = (
    <ListBox
      {...(disabledKeys.length > 0
        ? {
            disabledKeys,
          }
        : {})}
      {...(isVirtualized
        ? {
            className: "max-h-60 overflow-y-auto",
          }
        : {})}
    >
      {options.map((option) => (
        // HeroUI's select popover sets `px-2.5` on items with the same
        // specificity as the base `:has(.list-box-item__indicator) { pe-7 }`
        // rule but later in import order, collapsing the end padding that
        // reserves room for the checkmark so it overlaps long labels. The
        // `pe-7` utility (utilities layer) restores it.
        <ListBox.Item
          key={option.id}
          id={option.id}
          textValue={option.label}
          className="relative pe-7"
        >
          {option.icon || option.detail ? (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {option.icon}
              <div className="flex min-w-0 flex-1 flex-col py-0.5">
                <Label className="truncate text-sm font-medium text-foreground">
                  {option.label}
                </Label>
                {option.detail ? (
                  <Description className="truncate font-mono text-[11px] text-muted">
                    {option.detail}
                  </Description>
                ) : null}
              </div>
            </div>
          ) : (
            option.label
          )}
          <ListBox.ItemIndicator />
        </ListBox.Item>
      ))}
    </ListBox>
  );
  return (
    <HeroSelect
      {...rest}
      value={selectedValue}
      onChange={(nextValue) => onChange(nextValue == null ? "" : String(nextValue))}
    >
      {label ? <Label>{label}</Label> : null}
      <HeroSelect.Trigger>
        <HeroSelect.Value>
          {({ defaultChildren, isPlaceholder }) => {
            if (isPlaceholder || !selectedOption) return defaultChildren;
            return (
              <span className="flex min-w-0 items-center gap-2">
                {selectedOption.icon}
                <span className="min-w-0 truncate">{selectedOption.label}</span>
              </span>
            );
          }}
        </HeroSelect.Value>
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      <HeroSelect.Popover {...popoverProps}>
        {isVirtualized ? (
          <Virtualizer
            layout={ListLayout}
            layoutOptions={{
              rowHeight: SELECT_DROPDOWN_ROW_HEIGHT,
            }}
          >
            {listBox}
          </Virtualizer>
        ) : (
          listBox
        )}
      </HeroSelect.Popover>
    </HeroSelect>
  );
}
