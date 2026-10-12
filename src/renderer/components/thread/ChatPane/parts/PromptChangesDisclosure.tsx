import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Retarget async diff heights within the same short disclosure transition. */
export function PromptChangesDisclosure(props: {
  id: string;
  expanded: boolean;
  /** File data can arrive after opening; the outer review must track child motion directly. */
  animateContentChanges?: boolean;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState(props.expanded);
  if (props.expanded && !present) setPresent(true);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const deadline = performance.now() + 160;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const height = props.expanded ? content.scrollHeight : 0;
      container.style.transitionDuration = reducedMotion
        ? "0ms"
        : `${Math.max(props.expanded && props.animateContentChanges ? 80 : 0, deadline - performance.now())}ms`;
      container.style.height = `${height}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(content);
    const timeout = props.expanded ? undefined : window.setTimeout(() => setPresent(false), 160);
    return () => {
      observer.disconnect();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [props.expanded, props.animateContentChanges]);

  return (
    <div
      ref={containerRef}
      id={props.id}
      className="lc-prompt-disclosure"
      aria-hidden={!props.expanded}
      inert={!props.expanded}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && !props.expanded) setPresent(false);
      }}
    >
      <div ref={contentRef}>{present ? props.children : null}</div>
    </div>
  );
}
