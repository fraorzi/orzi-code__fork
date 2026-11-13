import { useState } from "react";
import { Button, Tooltip, toast } from "@heroui/react";
import { useLingui } from "@lingui/react/macro";
import { Check, TimerReset } from "lucide-react";
import type { Thread } from "@/shared/contracts";
import { friendlyError } from "@/shared/messages";
import { readBridge } from "@/renderer/bridge";
import { useAppStore } from "@/renderer/state/appStore";
import { selectUsageRecoveryResumedAt } from "./threadUsageRecoveryState";

export function ThreadUsageRecovery({ thread }: { thread: Thread }) {
  const [pending, setPending] = useState(false);
  const resumedAt = useAppStore((state) => selectUsageRecoveryResumedAt(state, thread.id));
  return (
    <UsageRecoveryToggle
      isSelected={thread.config.autoResumeAfterLimit === true}
      pending={pending}
      resumedAt={resumedAt}
      onChange={(enabled) => {
        setPending(true);
        void readBridge()
          .setThreadUsageRecovery({ threadId: thread.id, enabled })
          .then(() => {
            const current = useAppStore.getState().threads.find((item) => item.id === thread.id);
            if (current)
              useAppStore.getState().updateThreadConfig(thread.id, {
                ...current.config,
                autoResumeAfterLimit: enabled,
              });
          })
          .catch((error: unknown) => toast.danger(friendlyError(error)))
          .finally(() => setPending(false));
      }}
    />
  );
}

export function UsageRecoveryToggle({
  isSelected,
  pending = false,
  resumedAt,
  onChange,
}: {
  isSelected: boolean;
  pending?: boolean;
  resumedAt?: number | undefined;
  onChange(enabled: boolean): void;
}) {
  const { t, i18n } = useLingui();
  const label = isSelected
    ? t`Disable automatic resume after the usage limit resets`
    : t`Enable automatic resume after the usage limit resets`;
  const time =
    resumedAt === undefined ? "" : i18n.date(resumedAt, { dateStyle: "short", timeStyle: "short" });
  return (
    <span className={`relative inline-flex ${resumedAt !== undefined ? "pt-7" : ""}`}>
      {resumedAt !== undefined ? (
        <span
          role="status"
          className="pointer-events-none absolute left-0 top-0 z-10 flex items-center gap-1 whitespace-nowrap rounded-lg bg-surface px-2 py-1 text-[10px] text-muted shadow-sm"
        >
          <Check aria-hidden="true" className="size-3 text-success" />
          {t`Resumed after limit at ${time}`}
        </span>
      ) : null}
      <Tooltip delay={300}>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          className={`relative size-7 min-w-7 rounded-full ${isSelected ? "bg-accent/15 text-accent" : "text-muted"}`}
          aria-label={label}
          aria-pressed={isSelected}
          isDisabled={pending}
          onPress={() => onChange(!isSelected)}
        >
          <TimerReset aria-hidden="true" className="size-4" />
          {isSelected ? (
            <Check
              aria-hidden="true"
              className="absolute bottom-0 right-0 size-2.5 rounded-full bg-background stroke-[3]"
            />
          ) : null}
        </Button>
        <Tooltip.Content placement="top" className="text-xs">
          {label}
        </Tooltip.Content>
      </Tooltip>
    </span>
  );
}
