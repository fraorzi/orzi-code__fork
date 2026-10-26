import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { CopyTextButton } from "./CopyTextButton";
import "./markdownCodeBlock.css";

/** Keep copy controls out of tool output, which also uses the Shiki renderer. */
export function MarkdownCodeBlock({
  text,
  children,
  monospace = false,
}: {
  text: string;
  children: ReactNode;
  monospace?: boolean;
}) {
  const { t } = useLingui();
  return (
    <div className={`lc-chat-code-block not-prose${monospace ? " lc-chat-code-block--code" : ""}`}>
      {text.length > 0 && (
        <div className="lc-chat-code-copy">
          <CopyTextButton text={text} label={t`Copy code`} confirmation="icon" />
        </div>
      )}
      {children}
    </div>
  );
}
