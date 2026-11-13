import { Dropdown, Label } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { getFolderIconUrl } from "@/renderer/components/common/fileIcons";
import { getBasename } from "@/shared/pathUtils";
type FolderAction = "tree" | "explorer";
interface InlineFolderPathChipProps {
  path: string;
  onRevealInTree?: ((path: string) => void) | undefined;
  onShowInExplorer?: ((path: string) => void) | undefined;
}
export function InlineFolderPathChip({
  path,
  onRevealInTree,
  onShowInExplorer,
}: InlineFolderPathChipProps) {
  const { t } = useLingui();
  const basename = getBasename(path);
  const iconUrl = getFolderIconUrl(basename);
  const chipInner = (
    <>
      <img className="poracode-inline-path-chip__icon" src={iconUrl} alt="" draggable={false} />
      <span className="poracode-inline-path-chip__name">{path}</span>
    </>
  );
  const actions = [
    onRevealInTree
      ? {
          id: "tree",
          label: t`Reveal in file tree`,
          run: () => onRevealInTree(path),
        }
      : null,
    onShowInExplorer
      ? {
          id: "explorer",
          label: t`Show in file explorer`,
          run: () => onShowInExplorer(path),
        }
      : null,
  ].filter(
    (
      action,
    ): action is {
      id: FolderAction;
      label: string;
      run: () => void;
    } => action !== null,
  );
  if (actions.length === 0) {
    return (
      <span className="poracode-inline-path-chip" title={path}>
        {chipInner}
      </span>
    );
  }
  return (
    <Dropdown>
      <button type="button" className="poracode-inline-path-chip" title={path}>
        {chipInner}
      </button>
      <Dropdown.Popover className="min-w-[220px]">
        <Dropdown.Menu onAction={(key) => actions.find((a) => a.id === key)?.run()}>
          {onRevealInTree ? (
            <Dropdown.Item id="tree" textValue={t`Reveal in file tree`}>
              <Label>
                <Trans>Reveal in file tree</Trans>
              </Label>
            </Dropdown.Item>
          ) : null}
          {onShowInExplorer ? (
            <Dropdown.Item id="explorer" textValue={t`Show in file explorer`}>
              <Label>
                <Trans>Show in file explorer</Trans>
              </Label>
            </Dropdown.Item>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
