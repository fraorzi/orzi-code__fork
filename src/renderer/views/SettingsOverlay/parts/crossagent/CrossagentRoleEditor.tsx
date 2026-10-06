import { useId, useState } from "react";
import { Modal, toast } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Trash2 } from "lucide-react";
import { readBridge } from "@/renderer/bridge";
import { Button, Input, TextArea } from "@/renderer/components/common";
import type { ProviderModelMenuProvider } from "@/renderer/components/common/ProviderModelMenu";
import { useSharedSettings } from "@/renderer/state/sharedSettingsStore";
import { normalizeCrossagentTags } from "@/shared/crossagentRanking";
import type { CrossagentRoutingOverride, CrossagentRoutingSelection } from "@/shared/settings";
import { CrossagentRoleSelection, roleSelectionAvailable } from "./CrossagentRoleSelection";

export function CrossagentRoleEditor(props: {
  route?: CrossagentRoutingOverride;
  providers: ProviderModelMenuProvider[];
  onClose: () => void;
}) {
  const { t } = useLingui();
  const fieldId = useId();
  const [name, setName] = useState(props.route?.name ?? "");
  const [tags, setTags] = useState(props.route?.tags.join(", ") ?? "");
  const [instructions, setInstructions] = useState(props.route?.instructions ?? "");
  const [selection, setSelection] = useState<CrossagentRoutingSelection>(
    props.route ?? { agentKind: "" },
  );
  const [fallbacks, setFallbacks] = useState(props.route?.fallbacks ?? []);
  const [busy, setBusy] = useState(false);
  const tagInputs = tags.split(/[,\s]+/u).filter(Boolean);
  const normalizedTags = normalizeCrossagentTags(tagInputs);
  const valid =
    name.trim().length > 0 &&
    normalizedTags.length > 0 &&
    tagInputs.length <= 5 &&
    tagInputs.every((tag) => tag.length <= 32) &&
    roleSelectionAvailable(selection, props.providers) &&
    fallbacks.every((entry) => roleSelectionAvailable(entry, props.providers));

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const overrides = await readBridge().saveCrossagentRole({
        override: {
          tags: normalizedTags,
          name: name.trim(),
          instructions: instructions.trim(),
          agentKind: selection.agentKind,
          ...(selection.modelId ? { modelId: selection.modelId } : {}),
          ...(selection.effort ? { effort: selection.effort } : {}),
          ...(typeof selection.fast === "boolean" ? { fast: selection.fast } : {}),
          fallbacks,
          ...(props.route?.retryMode ? { retryMode: props.route.retryMode } : {}),
        },
        ...(props.route ? { previousTags: props.route.tags } : {}),
      });
      useSharedSettings.setState({ crossagentRoutingOverrides: overrides });
      props.onClose();
    } catch {
      toast.danger(t`Unable to save role. Check for duplicate task tags and try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy) props.onClose();
      }}
      isDismissable={!busy}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-[460px]">
          <Modal.CloseTrigger isDisabled={busy} />
          <Modal.Header>
            <Modal.Heading>
              {props.route ? <Trans>Edit role</Trans> : <Trans>Add role</Trans>}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="p-4">
            <div className="flex flex-col gap-3">
              <label htmlFor={`${fieldId}-name`} className="flex flex-col gap-1 text-xs text-muted">
                <span>
                  <Trans>Role name</Trans>
                </span>
                <Input
                  id={`${fieldId}-name`}
                  className="w-full"
                  aria-label={t`Role name`}
                  value={name}
                  maxLength={80}
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label htmlFor={`${fieldId}-tags`} className="flex flex-col gap-1 text-xs text-muted">
                <span>
                  <Trans>Task tags</Trans>
                </span>
                <Input
                  id={`${fieldId}-tags`}
                  className="w-full"
                  aria-label={t`Task tags`}
                  value={tags}
                  disabled={busy}
                  onChange={(event) => setTags(event.target.value)}
                />
              </label>
              <p className="text-xs text-muted">
                <Trans>
                  Enter up to five tags, separated by commas. The role matches tasks containing all
                  these tags.
                </Trans>
              </p>
              <div className="space-y-1.5">
                <p className="text-xs text-muted">
                  <Trans>Primary model</Trans>
                </p>
                <CrossagentRoleSelection
                  value={selection}
                  providers={props.providers}
                  disabled={busy}
                  onChange={setSelection}
                />
              </div>
              <label
                htmlFor={`${fieldId}-instructions`}
                className="flex flex-col gap-1 text-xs text-muted"
              >
                <span>
                  <Trans>Role instructions</Trans>
                </span>
                <TextArea
                  id={`${fieldId}-instructions`}
                  className="w-full"
                  aria-label={t`Role instructions`}
                  value={instructions}
                  rows={3}
                  maxLength={8000}
                  disabled={busy}
                  onChange={(event) => setInstructions(event.target.value)}
                />
              </label>
              <p className="text-xs text-muted">
                <Trans>
                  Instructions are added to the delegated task. They do not restrict the worker's
                  file access.
                </Trans>
              </p>
              <div className="space-y-2">
                <p className="text-xs text-muted">
                  <Trans>Fallback models</Trans>
                </p>
                {fallbacks.map((entry, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <CrossagentRoleSelection
                        value={entry}
                        providers={props.providers}
                        disabled={busy}
                        onChange={(next) =>
                          setFallbacks(
                            fallbacks.map((item, position) => (position === index ? next : item)),
                          )
                        }
                      />
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={t`Remove fallback ${index + 1}`}
                      isDisabled={busy}
                      onPress={() =>
                        setFallbacks(fallbacks.filter((_, position) => position !== index))
                      }
                    >
                      <Trash2 className="size-3.5 text-danger" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  isDisabled={busy || fallbacks.length >= 3 || props.providers.length === 0}
                  onPress={() => setFallbacks([...fallbacks, { agentKind: "" }])}
                >
                  <Trans>Add fallback model</Trans>
                </Button>
                <p className="text-xs text-muted">
                  {props.route?.retryMode === "any-failure" ? (
                    <Trans>
                      This existing route retries after any failure. A retry may repeat completed
                      work.
                    </Trans>
                  ) : (
                    <Trans>Fallbacks run only if a worker fails to start its task.</Trans>
                  )}
                </p>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="ghost"
              className="text-muted"
              isDisabled={busy}
              onPress={props.onClose}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              variant="tertiary"
              isDisabled={!valid}
              isPending={busy}
              onPress={() => void save()}
            >
              <Trans>Save role</Trans>
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
