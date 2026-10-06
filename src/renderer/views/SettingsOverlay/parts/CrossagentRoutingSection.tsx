// Modified for the orzi-code__fork personal fork by Franciszek Orzechowski on 2026-10-06.
import { useEffect, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { readBridge } from "@/renderer/bridge";
import { TextArea } from "@/renderer/components/common";
import { distinctSubProviderLabel } from "@/renderer/components/common/ProviderModelMenu";
import { useAgentStatusesStore } from "@/renderer/state/agentStatusesStore";
import { useSharedSettings } from "@/renderer/state/sharedSettingsStore";
import type {
  CrossagentRoutingSnapshotEntry,
  CrossagentRoutingState,
} from "@/shared/crossagentRanking";
import { presentedCrossagentCapabilities } from "@/shared/crossagentVisibility";
import { CrossagentMemorySection } from "./crossagent/CrossagentMemorySection";
import { CrossagentProviderModelFilter } from "./crossagent/CrossagentProviderModelFilter";
import { CrossagentRolesSection } from "./crossagent/CrossagentRolesSection";
import { CrossagentRankedRow } from "./crossagent/CrossagentRankedRow";

/**
 * Crossagents routing settings: the live globally ranked (provider, model)
 * order with one global provider/model checklist (unchecked providers and
 * models are skipped by Crossagents), the editable learned routing memory,
 * user-pinned task routes, and the free-text routing guide appended to the
 * Crossagents MCP instructions.
 */
export function CrossagentRoutingSection() {
  const { t } = useLingui();
  const crossagentRoutingGuide = useSharedSettings((s) => s.crossagentRoutingGuide);
  const crossagentSelectionUsage = useSharedSettings((s) => s.crossagentSelectionUsage);
  const crossagentRoutingOverrides = useSharedSettings((s) => s.crossagentRoutingOverrides);
  const crossagentPausedProviders = useSharedSettings((s) => s.crossagentPausedProviders);
  const crossagentHiddenModels = useSharedSettings((s) => s.crossagentHiddenModels);
  const agentSelectionUsage = useSharedSettings((s) => s.agentSelectionUsage);
  const favoriteModels = useSharedSettings((s) => s.favoriteModels);
  const disabledAgents = useSharedSettings((s) => s.disabledAgents);
  const hiddenModels = useSharedSettings((s) => s.hiddenModels);
  const statuses = useAgentStatusesStore((s) => s.agentStatuses);
  const setCrossagentRoutingGuide = useSharedSettings((s) => s.setCrossagentRoutingGuide);
  const [draft, setDraft] = useState(crossagentRoutingGuide);
  const [routing, setRouting] = useState<CrossagentRoutingState>({ ranked: [], providers: [] });
  // Eligible providers missing from the ranked order were excluded by the
  // user's checklist (paused, or every model unchecked) — keep them glanceable
  // while the popover is closed.
  const rankedProviderKinds = new Set(routing.ranked.map((entry) => entry.provider));
  const skippedProviderNames = routing.providers
    .filter((provider) => !rankedProviderKinds.has(provider.kind))
    .map((provider) => provider.label);

  // Ranked rows are per-model, so resolve each provider's presented capability
  // once instead of rebuilding it for every row.
  const capabilitiesByKind = new Map(
    routing.providers.flatMap((provider) => {
      const status = statuses.find((candidate) => candidate.kind === provider.kind);
      if (!status) return [];
      return [
        [
          provider.kind,
          presentedCrossagentCapabilities(provider.execution, status.capabilities),
        ] as const,
      ];
    }),
  );

  // Aggregator providers (OpenCode, Command Code, …) expose same-label models
  // from different sub-providers; surface the sub-provider to tell them apart.
  function subProviderLabelFor(entry: CrossagentRoutingSnapshotEntry): string | undefined {
    const capabilities = capabilitiesByKind.get(entry.provider);
    if (!capabilities) return undefined;
    return distinctSubProviderLabel(entry.model.id, capabilities, entry.label);
  }
  // Joined into a stable primitive so the refresh effect below re-fires on
  // routing-input changes without listing nine trigger-only deps (and without
  // a useMemo — React Compiler).
  const routingRefreshKey = JSON.stringify([
    statuses,
    disabledAgents,
    hiddenModels,
    crossagentPausedProviders,
    crossagentHiddenModels,
    crossagentSelectionUsage,
    crossagentRoutingOverrides,
    agentSelectionUsage,
    favoriteModels,
  ]);
  const requestedRoutingKeyRef = useRef(routingRefreshKey);
  useEffect(() => {
    // The snapshot takes no arguments — it reflects the persisted routing
    // inputs — so the inputs are joined into a single request key. The effect
    // consumes the key (tags the request, ignores superseded responses) and
    // re-fires only when the inputs actually change.
    const requestKey = routingRefreshKey;
    requestedRoutingKeyRef.current = requestKey;
    let active = true;
    void readBridge()
      .getCrossagentRouting()
      .then((state) => {
        if (!active || requestedRoutingKeyRef.current !== requestKey) return;
        setRouting(state);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [routingRefreshKey]);

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            <Trans>Worker model pool</Trans>
          </p>
          <CrossagentProviderModelFilter providers={routing.providers} />
        </div>
        <p className="text-xs text-muted">
          <Trans>
            Choose the providers and models available for delegation. This pool also applies to
            roles and their fallback models.
          </Trans>
        </p>
      </section>
      <CrossagentRolesSection providers={routing.providers} />
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            <Trans>Current routing order</Trans>
          </p>
        </div>
        <p className="text-xs text-muted">
          <Trans>
            Agents classify delegated work with task tags. Manual task routes rank first, followed
            by matching learned routes, global Crossagents usage, normal agent usage and favorites,
            and built-in order.
          </Trans>
        </p>
        {routing.ranked.length > 0 ? (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            {routing.ranked.map((entry) => {
              const subProviderLabel = subProviderLabelFor(entry);
              return (
                <CrossagentRankedRow
                  key={`${entry.provider}:${entry.model.id}`}
                  entry={entry}
                  {...(subProviderLabel ? { subProviderLabel } : {})}
                />
              );
            })}
          </div>
        ) : null}
        {skippedProviderNames.length > 0 ? (
          <p className="text-xs text-muted">
            {t`Skipped by Crossagents: ${skippedProviderNames.join(", ")}`}
          </p>
        ) : null}
        <p className="text-xs text-muted">
          <Trans>
            Anything currently unavailable — a provider, model, reasoning level, or Fast mode — is
            skipped automatically. Unchecked providers and models are skipped until re-checked.
          </Trans>
        </p>
      </section>
      <CrossagentMemorySection />
      <section className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          <Trans>Crossagent routing guide</Trans>
        </p>
        <p className="text-xs text-muted">
          <Trans>
            Instructions agents follow when choosing which agent or model to delegate to.
          </Trans>
        </p>
        <TextArea
          aria-label={t`Crossagent routing guide`}
          className="w-full text-xs"
          rows={4}
          placeholder={t`e.g. Codex GPT-5.5 fast for quick lookups, OpenCode GLM for bulk refactors, Claude Opus for anything subtle.`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setCrossagentRoutingGuide(draft.trim())}
        />
      </section>
    </div>
  );
}
