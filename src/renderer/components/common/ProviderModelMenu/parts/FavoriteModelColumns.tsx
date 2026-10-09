import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { ProviderIcon } from "@/renderer/components/providers/ProviderIcon";
import type { ProviderModelRow } from "./types";
import type { ModelListHandle, ModelListProps } from "./WindowedProviderModelList";
import { ModelMenuRow } from "./ModelMenuRow";

/** Columns belong to the account/provider that launches the model, never its manufacturer. */
export const FavoriteModelColumns = forwardRef<ModelListHandle, ModelListProps>(
  function FavoriteModelColumns(props, ref) {
    const { t } = useLingui();
    const { onActiveChange } = props;
    const rows = props.items.filter((item): item is ProviderModelRow => item.type === "model");
    const groups = new Map<string, ProviderModelRow[]>();
    for (const row of rows) {
      const group = groups.get(row.providerKind);
      if (group) group.push(row);
      else groups.set(row.providerKind, [row]);
    }
    const [activeId, setActiveId] = useState<string | undefined>(
      () => rows.find((row) => props.selectedKeys.has(row.id))?.id ?? rows[0]?.id,
    );
    const active = rows.find((row) => row.id === activeId) ?? rows[0];
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => onActiveChange(active?.id ?? null), [active?.id, onActiveChange]);
    useEffect(() => {
      const options = scrollRef.current?.querySelectorAll('[role="option"]');
      for (const option of options ?? []) {
        if (option.id === `${props.domIdPrefix}-${active?.id}`)
          option.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }
    }, [active?.id, props.domIdPrefix]);
    function moveActive(delta: number) {
      const index = rows.findIndex((row) => row.id === active?.id);
      setActiveId(rows[Math.max(0, Math.min(rows.length - 1, index + delta))]?.id);
    }
    function moveHorizontal(delta: number) {
      if (!active) return;
      const columns = [...groups.values()];
      const columnIndex = columns.findIndex((column) => column.some((row) => row.id === active.id));
      const rowIndex = columns[columnIndex]?.findIndex((row) => row.id === active.id) ?? 0;
      const target = columns[columnIndex + delta];
      if (target) setActiveId(target[Math.min(rowIndex, target.length - 1)]?.id);
    }
    useImperativeHandle(ref, () => ({
      moveActive,
      moveHorizontal,
      selectActive: () => {
        if (active) props.onSelect(active.id);
      },
    }));
    return (
      <div
        ref={scrollRef}
        id={`${props.domIdPrefix}-listbox`}
        role="listbox"
        aria-label={t`Favorites`}
        aria-activedescendant={active ? `${props.domIdPrefix}-${active.id}` : undefined}
        tabIndex={0}
        className="poracode-favorite-model-columns no-scrollbar max-h-72 overflow-auto outline-none"
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            moveActive(event.key === "ArrowDown" ? 1 : -1);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            moveHorizontal(event.key === "ArrowRight" ? 1 : -1);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            setActiveId(event.key === "Home" ? rows[0]?.id : rows.at(-1)?.id);
          } else if (event.key === "Enter" && active) {
            event.preventDefault();
            props.onSelect(active.id);
          }
        }}
      >
        {[...groups].map(([kind, models]) => (
          <div key={kind} role="group" aria-label={models[0]?.providerLabel} className="min-w-0">
            <div className="flex h-9 items-center gap-2 border-b border-border px-3 text-xs text-muted">
              <ProviderIcon
                kind={kind}
                className="size-3.5"
                fallbackLabel={models[0]?.providerLabel ?? kind}
              />
              <span className="truncate">{models[0]?.providerLabel}</span>
            </div>
            {models.map((item) => (
              <ModelMenuRow
                key={item.id}
                item={item}
                domIdPrefix={props.domIdPrefix}
                modelRowHeight={props.mobile ? 44 : 36}
                isSelected={props.selectedKeys.has(item.id)}
                isActive={item.id === active?.id}
                onSelect={props.onSelect}
                modelFastEnabled={props.modelFastEnabled}
                toggleFavorite={props.toggleFavorite}
                onPointerMove={(event) => {
                  if (event.movementX !== 0 || event.movementY !== 0) setActiveId(item.id);
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  },
);
