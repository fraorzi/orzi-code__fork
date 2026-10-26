import { useLayoutEffect, useRef, useState } from "react";
import { Button, Tooltip, toast } from "@heroui/react";
import { useLingui } from "@lingui/react/macro";
import { Check, Copy } from "lucide-react";
import { friendlyError } from "@/shared/messages";

interface CopyTextButtonProps {
  text: string;
  /** Idle tooltip / aria-label (already translated), e.g. t`Copy message`. */
  label: string;
  /** Inline blocks confirm with a checkmark without opening a tooltip on click. */
  confirmation?: "tooltip" | "icon";
}

/**
 * Small hover-strip icon button that copies `text` to the clipboard and flips
 * its tooltip to "Copied" for a moment. Shared by the user/assistant message
 * action strips and markdown code blocks.
 */
export function CopyTextButton({ text, label, confirmation = "tooltip" }: CopyTextButtonProps) {
  const { t } = useLingui();
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const labelResetTimerRef = useRef<number | null>(null);

  useLayoutEffect(
    () => () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
      if (labelResetTimerRef.current !== null) window.clearTimeout(labelResetTimerRef.current);
    },
    [],
  );

  return (
    <Tooltip delay={300} isOpen={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
      <Tooltip.Trigger>
        <Button
          isIconOnly
          variant="ghost"
          aria-label={copyState === "copied" ? t`Copied` : label}
          data-copied={copyState === "copied"}
          className="size-5 min-w-0 rounded p-0 text-muted/70 shadow-none transition-colors hover:bg-foreground/5 hover:text-foreground"
          onPress={() => {
            navigator.clipboard
              .writeText(text)
              .then(() => {
                setCopyState("copied");
                if (confirmation === "tooltip") setIsTooltipOpen(true);
                if (resetTimerRef.current !== null) {
                  window.clearTimeout(resetTimerRef.current);
                }
                if (labelResetTimerRef.current !== null) {
                  window.clearTimeout(labelResetTimerRef.current);
                }
                resetTimerRef.current = window.setTimeout(() => {
                  setIsTooltipOpen(false);
                  resetTimerRef.current = null;
                  labelResetTimerRef.current = window.setTimeout(() => {
                    setCopyState("idle");
                    labelResetTimerRef.current = null;
                  }, 200);
                }, 1200);
              })
              .catch((error: unknown) => {
                toast.danger(friendlyError(error));
              });
          }}
        >
          {confirmation === "icon" && copyState === "copied" ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content placement="top">
        {copyState === "copied" ? t`Copied` : label}
      </Tooltip.Content>
    </Tooltip>
  );
}
