import { Plus, Zap } from "lucide-react";
import { Tooltip } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import type { LabeledOption } from "@/shared/contracts";
import { LightballTabs } from "../../LightballTabs";
import { ToggleSwitch } from "../../ToggleSwitch";
import { Button } from "../../Button";

/** Per-model settings shown in the menu footer, only when the model declares them. */
export interface ModelMenuSettings {
  efforts: readonly LabeledOption[];
  effortValue?: string;
  onEffortChange: (value: string) => void;
  fast?: {
    isSelected: boolean;
    disabledReason?: string;
    onChange: (selected: boolean) => void;
  };
}

export function ModelMenuFooter(props: {
  settings: ModelMenuSettings | undefined;
  onAddModel: () => void;
}) {
  const { t } = useLingui();
  const { settings } = props;
  const fast = settings?.fast;
  const fastSwitch = fast ? (
    <ToggleSwitch
      size="sm"
      aria-label={t`Fast mode`}
      isSelected={fast.isSelected}
      isDisabled={fast.disabledReason !== undefined}
      onChange={fast.onChange}
    />
  ) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-2 py-1.5 [contain:inline-size]">
      <Button variant="ghost" size="sm" onPress={props.onAddModel}>
        <Plus className="size-3.5" />
        <Trans>Add model</Trans>
      </Button>
      <span className="flex-1" />
      {settings && settings.efforts.length > 0 ? (
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted/70">
            <Trans>Effort</Trans>
          </span>
          <LightballTabs
            tabs={settings.efforts.map((effort) => ({ id: effort.id, label: effort.label }))}
            active={settings.effortValue ?? settings.efforts[0]!.id}
            onChange={settings.onEffortChange}
            ariaLabel={t`Effort`}
            shape="rounded"
          />
        </span>
      ) : null}
      {fast ? (
        <span className="flex items-center gap-1.5 text-xs">
          <Zap className="size-3.5 text-muted" />
          <Trans>Fast</Trans>
          {fast.disabledReason ? (
            <Tooltip delay={150}>
              <Tooltip.Trigger>{fastSwitch}</Tooltip.Trigger>
              <Tooltip.Content>{fast.disabledReason}</Tooltip.Content>
            </Tooltip>
          ) : (
            fastSwitch
          )}
        </span>
      ) : null}
    </div>
  );
}
