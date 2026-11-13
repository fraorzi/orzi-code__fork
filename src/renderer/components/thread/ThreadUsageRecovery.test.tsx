import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { threadSchema } from "@/shared/contracts";
import { useAppStore } from "@/renderer/state/appStore";
import { renderWithI18n as render } from "@/renderer/testUtils/i18n";
import { ThreadUsageRecovery } from "./ThreadUsageRecovery";

const bridge = vi.hoisted(() => ({ setThreadUsageRecovery: vi.fn<() => Promise<void>>() }));
vi.mock("@/renderer/bridge", () => ({ readBridge: () => bridge }));

const thread = threadSchema.parse({
  id: "quota-thread",
  projectId: "project",
  title: "Test",
  agentKind: "test-agent",
  config: { model: "model" },
  status: "error",
  attention: "error",
  createdAt: "2026-10-27T12:00:00.000Z",
  updatedAt: "2026-10-27T12:00:00.000Z",
});

beforeEach(() => {
  bridge.setThreadUsageRecovery.mockReset().mockResolvedValue(undefined);
  useAppStore.setState({ threads: [thread] });
  useAppStore.setState({ runtimeItemIdsByThread: {}, runtimeItemsByIdByThread: {} });
});

it("shows a durable receipt from completed history when reopening an inactive thread", () => {
  useAppStore.setState({
    runtimeItemIdsByThread: { [thread.id]: ["answer"] },
    runtimeItemsByIdByThread: {
      [thread.id]: {
        answer: {
          id: "answer",
          type: "assistant_message",
          state: "completed",
          streams: {},
          payload: { usageRecoveryResumedAt: Date.parse("2026-10-29T19:50:00Z") },
        },
      },
    },
  });
  render(<ThreadUsageRecovery thread={{ ...thread, status: "inactive" }} />);
  expect(screen.getByRole("status")).toHaveTextContent("Resumed after limit at");
});

it("does not report success for an enabled option or an unconfirmed streaming message", () => {
  useAppStore.setState({
    runtimeItemIdsByThread: { [thread.id]: ["answer"] },
    runtimeItemsByIdByThread: {
      [thread.id]: {
        answer: {
          id: "answer",
          type: "assistant_message",
          state: "started",
          streams: {},
          payload: { usageRecoveryResumedAt: Date.now() },
        },
      },
    },
  });
  render(
    <ThreadUsageRecovery
      thread={{ ...thread, config: { ...thread.config, autoResumeAfterLimit: true } }}
    />,
  );
  expect(screen.queryByRole("status")).toBeNull();
});

it("enables recovery in the supervisor and saves the option without clearing the quota error", async () => {
  const view = render(<ThreadUsageRecovery thread={thread} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Enable automatic resume after the usage limit resets" }),
  );
  await waitFor(() =>
    expect(useAppStore.getState().threads[0]?.config.autoResumeAfterLimit).toBe(true),
  );
  expect(bridge.setThreadUsageRecovery).toHaveBeenCalledExactlyOnceWith({
    threadId: thread.id,
    enabled: true,
  });
  expect(useAppStore.getState().threads[0]?.status).toBe("error");
  view.rerender(
    <ThreadUsageRecovery
      thread={{ ...thread, config: { ...thread.config, autoResumeAfterLimit: true } }}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Disable automatic resume after the usage limit resets" }),
  ).toHaveAttribute("aria-pressed", "true");
});

it("keeps the saved option unchanged when the supervisor rejects it", async () => {
  bridge.setThreadUsageRecovery.mockRejectedValue(new Error("Unavailable"));
  render(<ThreadUsageRecovery thread={thread} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Enable automatic resume after the usage limit resets" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Enable automatic resume after the usage limit resets" }),
    ).not.toBeDisabled(),
  );
  expect(useAppStore.getState().threads[0]?.config.autoResumeAfterLimit).toBeUndefined();
});
