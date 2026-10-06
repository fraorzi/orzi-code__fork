import { useState } from "react";
import { toast } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { isRemoteSession, readBridge } from "@/renderer/bridge";
import { Button } from "@/renderer/components/common";
import { statusToMenuProvider } from "@/renderer/components/common/ProviderModelMenu";
import { useAgentStatusesStore } from "@/renderer/state/agentStatusesStore";
import { useSharedSettings } from "@/renderer/state/sharedSettingsStore";
import type { CrossagentRoutingProviderEntry } from "@/shared/crossagentRanking";
import {
  filterCrossagentCapabilities,
  isCrossagentProviderEnabled,
  presentedCrossagentCapabilities,
} from "@/shared/crossagentVisibility";
import { formatReasoningLabel } from "@/shared/modelLabels";
import type { CrossagentRoutingOverride } from "@/shared/settings";
import { CrossagentRoleEditor } from "./CrossagentRoleEditor";
import { roleSelectionAvailable } from "./CrossagentRoleSelection";

export function CrossagentRolesSection(props: { providers: CrossagentRoutingProviderEntry[] }) {
  const { t } = useLingui();
  const routes = useSharedSettings((s) => s.crossagentRoutingOverrides);
  const disabledAgents = useSharedSettings((s) => s.disabledAgents);
  const hiddenModels = useSharedSettings((s) => s.hiddenModels);
  const crossagentPausedProviders = useSharedSettings((s) => s.crossagentPausedProviders);
  const crossagentHiddenModels = useSharedSettings((s) => s.crossagentHiddenModels);
  const statuses = useAgentStatusesStore((s) => s.agentStatuses);
  const [editing, setEditing] = useState<
    { kind: "new" } | { kind: "existing"; route: CrossagentRoutingOverride } | null
  >(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const visibility = {
    disabledAgents,
    hiddenModels,
    crossagentPausedProviders,
    crossagentHiddenModels,
  };
  const providers = props.providers.flatMap((entry) => {
    const status = statuses.find((candidate) => candidate.kind === entry.kind);
    if (!status || !isCrossagentProviderEnabled(entry.kind, visibility)) return [];
    const capabilities = filterCrossagentCapabilities(
      entry.kind,
      entry.execution,
      presentedCrossagentCapabilities(entry.execution, status.capabilities),
      visibility,
    );
    return capabilities.models.length > 0
      ? [{ ...statusToMenuProvider(status), capabilities }]
      : [];
  });

  async function remove(route: CrossagentRoutingOverride) {
    setRemoving(route.tags.join(" "));
    try {
      const overrides = await readBridge().removeCrossagentRoutingOverride({ tags: route.tags });
      useSharedSettings.setState({ crossagentRoutingOverrides: overrides });
    } catch {
      toast.danger(t`Unable to remove pinned route.`);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          <Trans>Worker roles</Trans>
        </p>
        {!isRemoteSession() ? (
          <Button
            size="sm"
            variant="ghost"
            isDisabled={providers.length === 0}
            onPress={() => setEditing({ kind: "new" })}
          >
            <Plus className="size-3.5" />
            <Trans>Add role</Trans>
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        <Trans>
          Name a role and assign task tags, model preferences and instructions. The lead agent
          chooses roles by matching task tags.
        </Trans>
      </p>
      {routes.length === 0 ? (
        <p className="text-xs text-muted">
          <Trans>No worker roles yet.</Trans>
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {routes.map((route) => {
            const tagLabel = route.tags.map((tag) => `#${tag}`).join(" + ");
            const providerAvailable = providers.some((entry) => entry.kind === route.agentKind);
            const available = route.modelId
              ? roleSelectionAvailable(route, providers)
              : providerAvailable;
            const detail = [
              route.agentKind,
              route.modelId,
              ...(route.effort ? [formatReasoningLabel(route.effort)] : []),
              ...(route.fast ? [t`Fast`] : []),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div
                key={route.tags.join(" ")}
                className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  {route.name ? (
                    <p className="truncate text-sm text-foreground">{route.name}</p>
                  ) : null}
                  <p className="truncate text-xs text-foreground">{tagLabel}</p>
                  <p className="truncate text-xs text-muted">
                    {detail}
                    {!providerAvailable
                      ? ` · ${t`Unavailable provider`}`
                      : !available
                        ? ` · ${t`Unavailable model`}`
                        : null}
                  </p>
                </div>
                {!isRemoteSession() ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={t`Edit role for ${tagLabel}`}
                      isDisabled={removing !== null}
                      onPress={() => setEditing({ kind: "existing", route })}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={t`Remove pinned route for ${tagLabel}`}
                      isPending={removing === route.tags.join(" ")}
                      isDisabled={removing !== null}
                      onPress={() => void remove(route)}
                    >
                      <Trash2 className="size-3.5 text-danger" />
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {editing ? (
        <CrossagentRoleEditor
          providers={providers}
          onClose={() => setEditing(null)}
          {...(editing.kind === "existing" ? { route: editing.route } : {})}
        />
      ) : null}
    </section>
  );
}
