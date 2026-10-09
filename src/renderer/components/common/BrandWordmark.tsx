import { Trans, useLingui } from "@lingui/react/macro";

export function BrandWordmark({ className }: { className?: string | undefined }) {
  const { t } = useLingui();
  return (
    <span className={className} aria-label={t`Orzi Code`}>
      <span className="font-semibold" aria-hidden="true">
        <Trans>Orzi Code</Trans>
      </span>
    </span>
  );
}
