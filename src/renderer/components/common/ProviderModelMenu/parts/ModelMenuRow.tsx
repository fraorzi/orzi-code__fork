import type { PointerEventHandler } from "react";
import { useLingui } from "@lingui/react/macro";
import { Check, Star, Zap } from "lucide-react";
import { Tooltip } from "@heroui/react";
import { ProviderIcon } from "@/renderer/components/providers/ProviderIcon";
import type { ProviderModelRow } from "./types";
import type { ModelListProps } from "./WindowedProviderModelList";
import { splitModelLabel } from "./splitModelLabel";

const MODEL_DESCRIPTION_TOOLTIP_DELAY_MS = 1000;

export function ModelMenuRow({
  item,
  domIdPrefix,
  modelRowHeight,
  isSelected,
  isActive,
  onSelect,
  modelFastEnabled,
  toggleFavorite,
  onPointerMove,
}: Pick<
  ModelListProps,
  "domIdPrefix" | "modelRowHeight" | "onSelect" | "modelFastEnabled" | "toggleFavorite"
> & {
  item: ProviderModelRow;
  isSelected: boolean;
  isActive: boolean;
  onPointerMove?: PointerEventHandler<HTMLDivElement>;
}) {
  const { t } = useLingui();
  return (
    <div
      id={`${domIdPrefix}-${item.id}`}
      role="option"
      aria-selected={isSelected}
      data-active={isActive ? "true" : undefined}
      className="poracode-menu-item group mx-1.5 flex cursor-default items-center text-foreground"
      style={{ height: modelRowHeight }}
      onPointerMove={onPointerMove}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item.id);
        }
      }}
      tabIndex={-1}
    >
      <Check
        className={`size-3 shrink-0 transition-opacity ${isSelected ? "opacity-100" : "opacity-0"}`}
      />
      {(() => {
        // Some providers (Cursor ACP) bake their parameter chips into
        // the label string itself (e.g. "GPT-5.5 · 272K · Medium").
        // Render the head as the model name and the tail as muted hint.
        const { name, hint } = splitModelLabel(item.label);
        const mutedHint = [hint, item.contextDescription].filter(Boolean).join(" · ");
        const rowFastEnabled = modelFastEnabled(item.providerKind, item.modelId);
        const content = (
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="min-w-0 truncate">{name}</span>
            {item.supportsFast ? (
              // Filled when Fast mode is saved on for this model,
              // outlined when it merely supports it or Fast was saved off.
              <Zap
                role="img"
                aria-label={rowFastEnabled ? t`Fast mode` : t`Supports Fast mode`}
                className={
                  rowFastEnabled
                    ? "size-3 shrink-0 fill-current text-muted"
                    : "size-3 shrink-0 text-muted/60"
                }
              />
            ) : null}
            {mutedHint ? (
              <span className="shrink-0 text-[10px] leading-none text-muted/60">· {mutedHint}</span>
            ) : null}
          </span>
        );
        return item.tooltipDescription ? (
          <Tooltip delay={MODEL_DESCRIPTION_TOOLTIP_DELAY_MS}>
            {content}
            <Tooltip.Content
              placement="right"
              className="max-w-72 whitespace-normal break-words text-xs"
            >
              {item.tooltipDescription}
            </Tooltip.Content>
          </Tooltip>
        ) : (
          content
        );
      })()}
      {item.showProviderIcon || item.subProviderLabel ? (
        <span className="ml-auto flex min-w-0 max-w-[45%] items-center gap-1 text-muted/70">
          {item.subProviderLabel ? (
            <span className="min-w-0 truncate text-[10px]">{item.subProviderLabel}</span>
          ) : null}
          {item.showProviderIcon ? (
            <ProviderIcon
              kind={item.providerKind}
              {...(item.providerIcon ? { icon: item.providerIcon } : {})}
              fallbackLabel={item.providerLabel}
              tone="inactive"
              className="size-3 shrink-0"
            />
          ) : null}
        </span>
      ) : null}
      {item.hideFavoriteToggle ? null : (
        <button
          type="button"
          aria-label={item.isFavorite ? t`Remove from favorites` : t`Add to favorites`}
          className={`ml-1 flex size-5 shrink-0 items-center justify-center rounded transition ${
            item.isFavorite
              ? "text-foreground"
              : "text-muted/40 opacity-0 group-hover:opacity-100 hover:text-foreground"
          }`}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            toggleFavorite(item.providerKind, item.modelId, item.presentationMode);
          }}
        >
          <Star className="size-3.5" fill={item.isFavorite ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}
