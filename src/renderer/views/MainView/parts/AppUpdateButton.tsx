import { Button, Tooltip } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { RefreshCw } from "lucide-react";
import { readBridge } from "@/renderer/bridge";
import { useUpdateStore } from "@/renderer/state/updateStore";

export function AppUpdateButton(props: { tooltipPlacement?: "bottom" | "right" }) {
  const { t } = useLingui();
  const ready = useUpdateStore((state) => state.phase === "downloaded");
  if (!ready) return null;

  return (
    <Tooltip delay={150}>
      <Tooltip.Trigger>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="poracode-app-update size-[26px] min-w-0 rounded-[6px]"
          aria-label={t`Update and restart`}
          onPress={() => void readBridge().installUpdate()}
        >
          <RefreshCw className="size-4" />
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content placement={props.tooltipPlacement ?? "bottom"}>
        <Trans>Update and restart</Trans>
      </Tooltip.Content>
    </Tooltip>
  );
}
