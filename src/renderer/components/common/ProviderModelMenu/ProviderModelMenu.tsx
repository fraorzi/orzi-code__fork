import { startTransition, useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { ArrowLeft, ChevronDown, Plus, Search } from "lucide-react";
import { Tooltip } from "@heroui/react";
import { ProviderIcon } from "@/renderer/components/providers/ProviderIcon";
import { ResponsiveMenuSurface, useResponsiveMenu } from "../ResponsiveMenuSurface";
import { useSharedSettings } from "@/renderer/state/sharedSettingsStore";
import { effectiveProviderOrder } from "@/shared/machineSettings";
import { LOCAL_NATIVE_MACHINE_KEY } from "@/shared/machines";
import { baseAgentKind, type ThreadPresentationMode } from "@/shared/contracts";
import { migrateCursorBaseId, parseCursorModelId } from "@/shared/cursorModelId";
import { Button } from "../Button";
import {
  buildProviderModelItems,
  type ModelRef,
  type ProviderModelMenuProvider,
} from "./parts/buildItems";
import { deriveSubProvider } from "./parts/deriveSubProvider";
import { providerMenuKey } from "./parts/providerIdentity";
import type { ProviderModelItem } from "./parts/types";
import { WindowedProviderModelList, type ModelListHandle } from "./parts/WindowedProviderModelList";
import { FavoriteModelColumns } from "./parts/FavoriteModelColumns";
import { splitModelLabel } from "./parts/splitModelLabel";

const MODEL_MENU_ROW_HEIGHT = 28;
const MODEL_MENU_ROW_HEIGHT_MOBILE = 44;

export type { ProviderModelMenuProvider };

export interface ProviderModelMenuProps {
  /** Providers to surface (typically all installed agents for draft, locked-only otherwise). */
  providers: ProviderModelMenuProvider[];
  currentAgentKind: string;
  currentModel: string;
  /** When set, only this provider's rows are rendered. */
  lockedAgentKind?: string;
  presentationMode?: ThreadPresentationMode;
  /**
   * Machine whose provider-order preference applies ("local" when omitted).
   * Only affects ordering while the provider-order lock is off.
   */
  machineKey?: string;
  isDisabled?: boolean;
  hideLabelOnWrap?: boolean;
  forceHideLabel?: boolean;
  collapseTier?: number;
  openSignal?: number;
  onChange: (next: {
    agentKind: string;
    model: string;
    presentationMode?: ThreadPresentationMode;
  }) => void;
  onOpenChange?: (open: boolean) => void;
}

function normalizeCurrentModelForProvider(
  provider: ProviderModelMenuProvider | undefined,
  modelId: string,
): string {
  if (!provider || provider.capabilities.models.some((model) => model.id === modelId)) {
    return modelId;
  }
  if (baseAgentKind(provider.kind) !== "cursor") {
    return modelId;
  }
  const normalized = migrateCursorBaseId(parseCursorModelId(modelId).baseId);
  return provider.capabilities.models.some((model) => model.id === normalized)
    ? normalized
    : modelId;
}

function refsForPresentation(
  refs: readonly ModelRef[],
  presentationMode: ThreadPresentationMode | undefined,
): readonly ModelRef[] {
  if (!presentationMode) return refs;
  return refs.filter((ref) => ref.presentationMode === presentationMode);
}

export function ProviderModelMenu(props: ProviderModelMenuProps) {
  const {
    providers,
    currentAgentKind,
    currentModel,
    lockedAgentKind,
    presentationMode,
    isDisabled,
    hideLabelOnWrap,
    forceHideLabel = false,
    collapseTier,
    openSignal,
    onChange,
    onOpenChange,
  } = props;

  const { t } = useLingui();
  const { mobile } = useResponsiveMenu();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeModelItemId, setActiveModelItemId] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const searchRef = useRef<HTMLInputElement>(null);
  const windowedListRef = useRef<ModelListHandle>(null);
  const listboxDomIdPrefix = useId();

  const favorites = useSharedSettings((s) => s.favoriteModels);
  const providerOrder = useSharedSettings((s) =>
    effectiveProviderOrder(s, props.machineKey ?? LOCAL_NATIVE_MACHINE_KEY),
  );
  const hiddenModels = useSharedSettings((s) => s.hiddenModels);
  const providerModelPreferences = useSharedSettings((s) => s.providerModelPreferences);
  const providerConfigs = useSharedSettings((s) => s.providerConfigs);
  const toggleFavoriteModel = useSharedSettings((s) => s.toggleFavoriteModel);

  const currentProvider =
    providers.find(
      (p) =>
        p.kind === currentAgentKind &&
        (presentationMode === undefined || p.presentationMode === presentationMode),
    ) ?? providers.find((p) => p.kind === currentAgentKind);
  const currentProviderKey = currentProvider ? providerMenuKey(currentProvider) : currentAgentKind;
  const effectiveCurrentModel = normalizeCurrentModelForProvider(currentProvider, currentModel);
  const currentLabel =
    currentProvider?.capabilities.models.find((m) => m.id === effectiveCurrentModel)?.label ??
    effectiveCurrentModel;
  const currentLabelParts = splitModelLabel(currentLabel);
  const currentSubProvider = currentProvider
    ? deriveSubProvider(effectiveCurrentModel, currentProvider.capabilities)
    : undefined;
  const currentDisplayLabel = currentSubProvider
    ? `${currentLabelParts.name} · ${currentSubProvider.label}`
    : currentLabelParts.name;
  const [prevMenuOpen, setPrevMenuOpen] = useState(isOpen);
  if (prevMenuOpen !== isOpen) {
    setPrevMenuOpen(isOpen);
    if (isOpen) {
      setSearch("");
      setCatalogOpen(false);
    }
  }

  const wasMenuOpenRef = useRef(false);
  useEffect(() => {
    const opened = isOpen && !wasMenuOpenRef.current;
    wasMenuOpenRef.current = isOpen;
    // On mobile, auto-focusing search would pop the keyboard over the drawer;
    // let the user tap the field if they want to filter.
    if (opened && !mobile) setTimeout(() => searchRef.current?.focus(), 50);
  }, [isOpen, mobile]);

  // An external `openSignal` bump opens the menu, tracked as a render snapshot
  // with the previous effect's re-run semantics.
  const [prevOpenSignal, setPrevOpenSignal] = useState({
    signal: openSignal,
    disabled: isDisabled,
  });
  if (prevOpenSignal.signal !== openSignal || prevOpenSignal.disabled !== isDisabled) {
    setPrevOpenSignal({ signal: openSignal, disabled: isDisabled });
    if (openSignal !== undefined && !isDisabled) setIsOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) setActiveModelItemId(null);
    onOpenChange?.(open);
  }

  // Build the row model only while the popover is open. The composer can mount
  // this control twice for wrap measurement, so closed menus should stay as
  // cheap as a trigger label lookup.
  const deferredAgentKind = useDeferredValue(currentAgentKind);
  const deferredModel = useDeferredValue(effectiveCurrentModel);
  const activeFavorites = refsForPresentation(favorites, presentationMode);
  function buildItemsForSearch(searchValue: string) {
    return buildProviderModelItems({
      providers,
      search: searchValue,
      ...(lockedAgentKind ? { lockedAgentKind } : {}),
      currentAgentKind: deferredAgentKind,
      currentModel: deferredModel,
      favoriteStateRefs: activeFavorites,
      favorites: catalogOpen ? [] : activeFavorites,
      favoritesOnly: !catalogOpen,
      hiddenModels,
      providerOrder,
    });
  }

  const items = isOpen ? buildItemsForSearch(deferredSearch) : [];
  const FavoriteOrCatalogList = catalogOpen ? WindowedProviderModelList : FavoriteModelColumns;

  // Highlight the current model wherever it appears (provider section, favorites, recents).
  const selectedKeys = new Set<string>([
    `fav:${currentAgentKind}:${effectiveCurrentModel}`,
    `recent:${currentAgentKind}:${effectiveCurrentModel}`,
    `model:${currentProviderKey}:${effectiveCurrentModel}`,
  ]);

  // Rows mirror the Fast preference saved per model — an explicitly saved value
  // wins, otherwise the app default keeps Fast on for models that support it.
  // This is intentionally not the current draft's toggle: the icon answers
  // "what will selecting this model do", so every row resolves independently.
  function modelFastEnabled(providerKind: string, modelId: string): boolean {
    const saved = providerModelPreferences[providerKind]?.[modelId];
    if (saved) return saved.fast ?? true;
    const legacy = providerConfigs[providerKind];
    if (legacy?.model === modelId && legacy.fast !== undefined) return legacy.fast;
    return true;
  }

  function selectModelItem(selected: ProviderModelItem | undefined) {
    if (selected?.type !== "model") return;
    if (
      selected.providerKind === currentAgentKind &&
      selected.modelId === effectiveCurrentModel &&
      selected.providerKey === currentProviderKey
    ) {
      handleOpenChange(false);
      return;
    }
    // Close synchronously so the popover starts unmounting immediately, then
    // mark the upstream state cascade as a transition so the parent's effort/
    // context/fast resolution doesn't block the close animation.
    handleOpenChange(false);
    startTransition(() => {
      onChange({
        agentKind: selected.providerKind,
        model: selected.modelId,
        ...(selected.presentationMode ? { presentationMode: selected.presentationMode } : {}),
      });
    });
  }

  function handleSelect(itemId: string) {
    activateItem(items.find((item) => item.id === itemId));
  }

  function activateItem(item: ProviderModelItem | undefined) {
    if (catalogOpen) {
      if (item?.type === "model" && !item.isFavorite)
        toggleFavoriteModel(
          item.providerKind,
          item.modelId,
          item.presentationMode ?? presentationMode ?? "terminal",
        );
    } else selectModelItem(item);
  }

  const trigger = (
    <Button
      aria-label={t`Select model`}
      isDisabled={(isDisabled ?? false) || providers.length === 0}
      size="sm"
      variant="ghost"
      className="poracode-composer-menu poracode-composer-model-control min-w-0 px-2.5"
      {...(mobile ? { onPress: () => handleOpenChange(true) } : {})}
    >
      <ProviderIcon
        kind={currentAgentKind}
        {...(currentProvider?.icon ? { icon: currentProvider.icon } : {})}
        fallbackLabel={currentProvider?.label}
        tone="active"
        className="size-3.5 shrink-0"
      />
      <span
        data-collapse-tier={collapseTier}
        className={
          hideLabelOnWrap
            ? `poracode-composer-label-hideable flex min-w-0 flex-col items-start justify-center gap-0.5${forceHideLabel ? " is-hidden" : ""}`
            : "flex min-w-0 flex-col items-start justify-center gap-0.5"
        }
      >
        <span className="max-w-full truncate leading-tight">
          {currentLabelParts.name || t`Select model`}
        </span>
        {currentSubProvider ? (
          <span className="max-w-full truncate text-[10px] font-medium leading-tight text-muted/70">
            {currentSubProvider.label}
          </span>
        ) : null}
      </span>
      <ChevronDown
        data-collapse-tier={collapseTier}
        className={
          hideLabelOnWrap
            ? `poracode-composer-label-hideable size-3.5 text-muted${forceHideLabel ? " is-hidden" : ""}`
            : "size-3.5 text-muted"
        }
      />
    </Button>
  );

  const renderContent = ({ expanded }: { readonly expanded: boolean }) => (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        {catalogOpen ? (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setCatalogOpen(false);
              setSearch("");
            }}
          >
            <ArrowLeft className="size-3.5" />
            <Trans>Favorites</Trans>
          </Button>
        ) : (
          <span className="px-1 text-xs text-muted">
            <Trans>Favorites</Trans>
          </span>
        )}
        {!catalogOpen ? (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setCatalogOpen(true);
              setSearch("");
            }}
          >
            <Plus className="size-3.5" />
            <Trans>Add to favorites</Trans>
          </Button>
        ) : null}
      </div>
      <div className="poracode-model-menu-search flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="size-3.5 shrink-0 text-muted" />
        <input
          ref={searchRef}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
          placeholder={t`Search models...`}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={`${listboxDomIdPrefix}-listbox`}
          aria-expanded={isOpen}
          aria-activedescendant={
            activeModelItemId && items.length > 0
              ? `${listboxDomIdPrefix}-${activeModelItemId}`
              : undefined
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              handleOpenChange(false);
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (search !== deferredSearch) {
                activateItem(buildItemsForSearch(search).find((item) => item.type === "model"));
              } else if (items.length > 0) {
                windowedListRef.current?.selectActive();
              }
              return;
            }
            if (items.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              windowedListRef.current?.moveActive(e.key === "ArrowDown" ? 1 : -1);
            }
            if (
              !catalogOpen &&
              items.length > 0 &&
              (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
              search.length === 0
            ) {
              e.preventDefault();
              windowedListRef.current?.moveHorizontal?.(e.key === "ArrowRight" ? 1 : -1);
            }
          }}
        />
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-3 text-center text-sm text-muted">
          <Trans>No models found</Trans>
        </div>
      ) : (
        <FavoriteOrCatalogList
          domIdPrefix={listboxDomIdPrefix}
          items={items}
          selectedKeys={selectedKeys}
          ref={windowedListRef}
          modelRowHeight={mobile ? MODEL_MENU_ROW_HEIGHT_MOBILE : MODEL_MENU_ROW_HEIGHT}
          mobile={mobile}
          mobileExpanded={mobile && expanded}
          onActiveChange={setActiveModelItemId}
          modelFastEnabled={modelFastEnabled}
          toggleFavorite={(providerKind, modelId, rowPresentationMode) =>
            toggleFavoriteModel(
              providerKind,
              modelId,
              rowPresentationMode ?? presentationMode ?? "terminal",
            )
          }
          onSelect={handleSelect}
        />
      )}
    </>
  );

  return (
    <ResponsiveMenuSurface
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      label={t`Select model`}
      trigger={
        !mobile && hideLabelOnWrap ? (
          <Tooltip>
            {trigger}
            <Tooltip.Content placement="top">
              {currentDisplayLabel || t`Select model`}
            </Tooltip.Content>
          </Tooltip>
        ) : (
          trigger
        )
      }
      placement="top start"
      contentClassName={catalogOpen ? "w-96 p-0" : "w-auto max-w-[calc(100vw-2rem)] p-0"}
      dialogClassName="flex max-h-[28rem] flex-col overflow-hidden !p-0"
    >
      {renderContent}
    </ResponsiveMenuSurface>
  );
}
