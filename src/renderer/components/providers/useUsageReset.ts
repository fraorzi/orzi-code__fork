import { useState } from "react";
import type { UsageResetOutcome } from "@poracode/agents-usage/types";
import { useLingui } from "@lingui/react/macro";
import { readBridge } from "@/renderer/bridge";
import { useProviderUsageStore } from "@/renderer/state/providerUsageStore";

type ResetState =
  | { phase: "idle" | "confirm" | "pending" }
  | { phase: "result"; outcome: UsageResetOutcome };

export function useUsageReset(providerId: string | undefined, grantId: string) {
  const { t } = useLingui();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ResetState>({ phase: "idle" });
  const submit = async () => {
    if (!providerId || state.phase === "pending") return;
    setState({ phase: "pending" });
    try {
      const response = await readBridge().consumeProviderUsageReset({
        providerId,
        grantId,
        requestId,
      });
      if (response.outcome !== "unknown") setRequestId(crypto.randomUUID());
      if (response.snapshot) useProviderUsageStore.getState().mergeSnapshot(response.snapshot);
      setState({ phase: "result", outcome: response.outcome });
    } catch {
      setState({ phase: "result", outcome: "unknown" });
    }
  };
  const outcomeText = (outcome: UsageResetOutcome): string => {
    switch (outcome) {
      case "reset":
      case "already-redeemed":
        return t`Reset applied`;
      case "nothing-to-reset":
        return t`No eligible usage to reset yet.`;
      case "unavailable":
        return t`This reset is no longer available. Refresh the list.`;
      case "auth-required":
        return t`Reconnect your account to activate this reset.`;
      case "account-mismatch":
        return t`Connect the same account used by your agent.`;
      case "rate-limited":
        return t`The provider is rate limiting requests. Try again later.`;
      case "busy":
        return t`Another reset is being activated. Please wait.`;
      case "unsupported":
        return t`Direct activation is not available for this account.`;
      case "unknown":
        return t`The result could not be confirmed. Refresh before trying again.`;
    }
  };
  return { state, setState, submit, outcomeText };
}
