import { Trans, useLingui } from "@lingui/react/macro";
import { Button, OptionMenu } from "@/renderer/components/common";
import {
  ProviderModelMenu,
  type ProviderModelMenuProvider,
} from "@/renderer/components/common/ProviderModelMenu";
import { modelSelectionFor } from "@/shared/agentSelection";
import { formatReasoningLabel } from "@/shared/modelLabels";
import type { CrossagentRoutingSelection } from "@/shared/settings";

export function roleSelectionAvailable(
  selection: CrossagentRoutingSelection,
  providers: ProviderModelMenuProvider[],
): boolean {
  const provider = providers.find((entry) => entry.kind === selection.agentKind);
  if (
    !provider ||
    !selection.modelId ||
    !provider.capabilities.models.some((model) => model.id === selection.modelId)
  )
    return false;
  const options = modelSelectionFor(provider.capabilities, selection.modelId);
  return (
    (!selection.effort || options.reasoning.values.includes(selection.effort)) &&
    (selection.fast !== true || options.fast.available)
  );
}

export function CrossagentRoleSelection(props: {
  value: CrossagentRoutingSelection;
  providers: ProviderModelMenuProvider[];
  onChange: (selection: CrossagentRoutingSelection) => void;
  disabled: boolean;
}) {
  const { t } = useLingui();
  const provider = props.providers.find((entry) => entry.kind === props.value.agentKind);
  const options = provider
    ? modelSelectionFor(provider.capabilities, props.value.modelId ?? "")
    : undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <ProviderModelMenu
          providers={props.providers}
          currentAgentKind={props.value.agentKind}
          currentModel={props.value.modelId ?? ""}
          isDisabled={props.disabled}
          onChange={({ agentKind, model }) => props.onChange({ agentKind, modelId: model })}
        />
        {options && options.reasoning.values.length > 0 ? (
          <OptionMenu
            placeholder={t`Reasoning`}
            value={props.value.effort ?? ""}
            options={[
              { id: "", label: t`Default` },
              ...options.reasoning.values.map((id) => ({ id, label: formatReasoningLabel(id) })),
            ]}
            isDisabled={props.disabled}
            onChange={(effort) => {
              const { effort: _previous, ...selection } = props.value;
              props.onChange({ ...selection, ...(effort ? { effort } : {}) });
            }}
          />
        ) : null}
        {options?.fast.supported ? (
          <Button
            size="sm"
            variant={props.value.fast ? "secondary" : "ghost"}
            aria-pressed={props.value.fast === true}
            isDisabled={props.disabled || (!options.fast.available && !props.value.fast)}
            onPress={() => props.onChange({ ...props.value, fast: !props.value.fast })}
          >
            <Trans>Fast</Trans>
          </Button>
        ) : null}
      </div>
      {!roleSelectionAvailable(props.value, props.providers) ? (
        <p className="text-xs text-warning">
          <Trans>Choose an available model from the worker pool.</Trans>
        </p>
      ) : null}
    </div>
  );
}
