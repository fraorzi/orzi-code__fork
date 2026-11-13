import { useState } from "react";
import { Check, ChevronDown, GitBranch, GitFork } from "lucide-react";
import { Label, ListBox } from "@heroui/react";
import { useLingui } from "@lingui/react/macro";
import { Button } from "@/renderer/components/common/Button";
import { MenuPopover } from "@/renderer/components/common/MenuPopover";
export type WorktreeMode = "none" | "new" | "new-with-changes";
interface WorktreeModeOption {
  id: WorktreeMode;
  label: string;
  description: string;
  icon: typeof GitFork;
}
export function WorktreeModeSelect(props: {
  mode: WorktreeMode;
  /** Whether to offer the "carry uncommitted changes" variant. */
  canBringChanges: boolean;
  onChange: (mode: WorktreeMode) => void;
  isDisabled?: boolean;
  /** Render a shorter trigger for secondary control rows. */
  compact?: boolean;
}) {
  const { t } = useLingui();
  const [isOpen, setIsOpen] = useState(false);
  const iconSize = props.compact ? "size-3" : "size-3.5";
  const options: WorktreeModeOption[] = [
    {
      id: "none",
      label: t`Branch`,
      description: t`Work in the current checkout`,
      icon: GitBranch,
    },
    {
      id: "new",
      label: t`Worktree`,
      description: t`Run in a separate worktree`,
      icon: GitFork,
    },
    ...(props.canBringChanges
      ? [
          {
            id: "new-with-changes" as const,
            label: t`Worktree + changes`,
            description: t`Copy uncommitted changes here (keeps them on this branch)`,
            icon: GitFork,
          },
        ]
      : []),
  ];
  const selected = options.find((option) => option.id === props.mode) ?? options[0]!;
  const SelectedIcon = selected.icon;
  const triggerClassName = `poracode-composer-menu min-w-0 max-w-56 ${props.compact ? "poracode-composer-menu--compact px-2" : "px-2.5"}`;

  // Two options (no "bring changes" variant): a dropdown for a binary choice
  // is overkill on any device — a single-tap/click toggle between none ⇄ new

  if (options.length === 2) {
    const isOn = props.mode !== "none";
    return (
      <Button
        aria-label={t`Worktree mode`}
        aria-pressed={isOn}
        isDisabled={props.isDisabled ?? false}
        size="sm"
        variant="ghost"
        className={triggerClassName}
        onPress={() => props.onChange(isOn ? "none" : "new")}
      >
        <SelectedIcon className={`${iconSize} text-muted`} />
        <span className="truncate">{selected.label}</span>
      </Button>
    );
  }
  function handleSelect(mode: WorktreeMode) {
    props.onChange(mode);
    setIsOpen(false);
  }
  const trigger = (
    <Button
      aria-label={t`Worktree mode`}
      isDisabled={props.isDisabled ?? false}
      size="sm"
      variant="ghost"
      className={triggerClassName}
    >
      <SelectedIcon className={`${iconSize} text-muted`} />
      <span className="truncate">{selected.label}</span>
      <ChevronDown className={`${iconSize} text-muted`} />
    </Button>
  );
  const desktopContent = (
    <ListBox
      aria-label={t`Worktree mode`}
      className="poracode-menu"
      selectionMode="none"
      onAction={(key) => handleSelect(key as WorktreeMode)}
    >
      {options.map((option) => {
        const OptionIcon = option.icon;
        return (
          <ListBox.Item
            key={option.id}
            id={option.id}
            textValue={option.label}
            className="focus-visible:outline-none"
          >
            <OptionIcon className="size-3.5 shrink-0 text-muted" />
            <div className="flex min-w-0 flex-1 flex-col">
              <Label className="truncate">{option.label}</Label>
              <span className="truncate text-xs text-muted">{option.description}</span>
            </div>
            {option.id === props.mode ? (
              <Check className="size-3.5 shrink-0 text-foreground" />
            ) : null}
          </ListBox.Item>
        );
      })}
    </ListBox>
  );

  // compact desktop popover list.

  return (
    <MenuPopover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      label={t`Worktree mode`}
      trigger={trigger}
      triggerClassName="flex min-w-0 items-center"
      placement="top"
      contentClassName="w-64 p-0"
      dialogClassName="!p-0 !py-1"
    >
      {desktopContent}
    </MenuPopover>
  );
}
