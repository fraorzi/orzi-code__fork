import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithI18n as render } from "@/renderer/testUtils/i18n";
import { ThreadContextDock } from "./ThreadContextDock";
import { ThreadContextIndicator } from "./ThreadContextIndicator";
import type { ThreadContextUsageSummary } from "./threadContextUsage";
import { byTextContent } from "@/renderer/testUtils/text";

const summary: ThreadContextUsageSummary = {
  usedTokens: 71_000,
  maxTokens: 200_000,
  remainingTokens: 129_000,
  percent: 36,
  breakdown: [{ id: "input", label: "Input", tokens: 71_000 }],
  usedLabel: "71K",
  maxLabel: "200K",
  remainingLabel: "129K",
  percentLabel: "36%",
  headline: "36% full",
  detail: "71K / 200K tokens",
};

describe("ThreadContextIndicator", () => {
  it("separates task consumption and deferred tools from window occupancy", () => {
    render(
      <ThreadContextDock
        summary={{
          ...summary,
          autoCompactThreshold: 167_000,
          breakdown: [
            ...summary.breakdown,
            { id: "deferred", label: "Deferred catalog", tokens: 54_000, kind: "deferred" },
          ],
          taskUsage: {
            turnId: "task",
            calls: 2,
            inputTokens: 10,
            outputTokens: 20,
            cacheReadTokens: 1000,
            cacheWriteTokens: 50,
            contextTokensAtStart: 70_000,
          },
        }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("71K used")).toBeVisible();
    expect(screen.getByText("Tools loaded on demand (outside context)")).toBeVisible();
    expect(screen.getByText("Auto-compact at 167,000 tokens")).toBeVisible();
    expect(screen.getByTestId("thread-task-usage")).toHaveTextContent("Processed tokens1,080");
    expect(screen.getByTestId("thread-task-usage")).toHaveTextContent("Model calls2");
  });
  it("renders the context ring without any number and toggles the dock", () => {
    const onToggle = vi.fn<() => void>();
    const { container } = render(
      <ThreadContextIndicator summary={summary} isOpen={false} onToggle={onToggle} />,
    );

    const trigger = screen.getByRole("button", { name: "Show context usage details" });

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("data-tone", "normal");
    expect(
      container.querySelector(".poracode-context-indicator__ring-progress"),
    ).toBeInTheDocument();
    expect(container.querySelector(".poracode-context-indicator svg text")).not.toBeInTheDocument();
    expect(container.querySelector(".poracode-context-indicator__percent")).not.toBeInTheDocument();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders the composer context breakdown dock", () => {
    render(<ThreadContextDock summary={summary} onClose={() => undefined} />);

    expect(screen.getByRole("region", { name: "Thread context usage" })).toBeVisible();
    expect(screen.getByText(byTextContent("36% Full"))).toBeVisible();
    expect(screen.getByText("71K used")).toBeVisible();
    expect(screen.getByText("200K limit")).toBeVisible();
    expect(screen.getByText("Input")).toBeVisible();
    expect(screen.getByText("71,000")).toBeVisible();
  });
});
