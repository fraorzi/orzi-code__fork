import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type {
  ProviderUsageResetPayload,
  ProviderUsageResetResponse,
  UsageLoginResult,
} from "@/shared/contracts";
import { renderWithI18n } from "@/renderer/testUtils/i18n";
import { UsageResetCredits } from "./UsageResetCredits";
import { useProviderUsageStore } from "@/renderer/state/providerUsageStore";
import { useUsageLoginStateStore } from "@/renderer/state/usageLoginStateStore";

const mocks = vi.hoisted(() => ({
  consume: vi.fn<(request: ProviderUsageResetPayload) => Promise<ProviderUsageResetResponse>>(),
  signIn: vi.fn<() => Promise<UsageLoginResult>>(),
}));
vi.mock("@/renderer/bridge", () => ({
  isRemoteSession: () => false,
  readBridge: () => ({ consumeProviderUsageReset: mocks.consume }),
}));
vi.mock("./useUsageProviderLogin", () => ({
  useUsageProviderLogin: () => ({ signingIn: false, handleSignIn: mocks.signIn }),
}));
vi.mock("./providerManifest", () => ({
  getProviderManifest: (kind: string) => ({ kind, usageResetBrowserLogin: true }),
}));

const now = Date.parse("2026-11-11T12:00:00Z");
const grant = {
  id: "one",
  label: "Partial reset",
  remaining: 1,
  expiresAt: now + 60_000,
  canActivate: true,
};
beforeEach(() => {
  mocks.consume.mockResolvedValue({ outcome: "reset" });
  mocks.signIn.mockReset().mockResolvedValue({ ok: true });
  useUsageLoginStateStore.setState({ stored: {} });
});

it("removes expired offers and distinguishes a confirmed empty inventory", () => {
  const { rerender } = renderWithI18n(
    <UsageResetCredits credits={{ status: "known", grants: [grant] }} now={now} />,
  );
  expect(screen.getByText("Partial reset")).toBeVisible();
  expect(screen.getByText(/Expires .*2026/)).toBeVisible();
  rerender(<UsageResetCredits credits={{ status: "known", grants: [grant] }} now={now + 60_000} />);
  expect(screen.getByText("No saved resets")).toBeVisible();
  expect(screen.queryByText("Partial reset")).toBeNull();
});
it("does not equate an unknown inventory with zero resets", () => {
  renderWithI18n(
    <UsageResetCredits credits={{ status: "unknown", reason: "web-only" }} now={now} />,
  );
  expect(screen.getByText("Reset availability could not be read. Try refreshing.")).toBeVisible();
  expect(screen.queryByText("No saved resets")).toBeNull();
});
it("distinguishes a saved session from unreadable reset data after remounting", () => {
  useUsageLoginStateStore.getState().setStored("test", true);
  renderWithI18n(
    <UsageResetCredits
      providerId="test"
      credits={{ status: "unknown", reason: "unavailable" }}
      now={now}
    />,
  );
  expect(
    screen.getByText(
      "Account connected, but saved resets could not be read. Try refreshing or open usage in Orzi.",
    ),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Reconnect account" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Connect account" })).toBeNull();
  expect(screen.queryByText("No saved resets")).toBeNull();
});
it("shows a returned login error instead of silently repeating the connection prompt", async () => {
  mocks.signIn.mockResolvedValue({ ok: false, error: "Login timed out" });
  renderWithI18n(
    <UsageResetCredits
      providerId="test"
      credits={{ status: "unknown", reason: "web-only" }}
      now={now}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Connect account" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Login timed out");
});
it("requires confirmation and activates in Orzi without external navigation", async () => {
  renderWithI18n(
    <UsageResetCredits
      providerId="test"
      credits={{ status: "known", grants: [grant] }}
      now={now}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Use this reset" }));
  expect(mocks.consume).not.toHaveBeenCalled();
  expect(screen.getByText("Use this reset now? This cannot be undone.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Use reset" }));
  await waitFor(() => expect(mocks.consume).toHaveBeenCalledTimes(1));
  expect(mocks.consume).toHaveBeenCalledWith({
    providerId: "test",
    grantId: grant.id,
    requestId: expect.any(String),
  });
  expect(await screen.findByRole("status")).toHaveTextContent("Reset applied");
});
it("keeps the same idempotency key for an explicit retry after an unconfirmed response", async () => {
  mocks.consume.mockResolvedValue({ outcome: "unknown" });
  renderWithI18n(
    <UsageResetCredits
      providerId="test"
      credits={{ status: "known", grants: [grant] }}
      now={now}
    />,
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    fireEvent.click(screen.getByRole("button", { name: "Use this reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Use reset" }));
    await waitFor(() => expect(mocks.consume).toHaveBeenCalledTimes(attempt + 1));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "The result could not be confirmed.",
    );
  }
  expect(mocks.consume.mock.calls[0]?.[0].requestId).toBe(
    mocks.consume.mock.calls[1]?.[0].requestId,
  );
  expect(screen.queryByText("Reset applied")).toBeNull();
});
it("disables redemption until the provider confirms eligibility", () => {
  renderWithI18n(
    <UsageResetCredits
      providerId="test"
      credits={{ status: "known", grants: [{ ...grant, canActivate: false }] }}
      now={now}
    />,
  );
  expect(screen.getByRole("button", { name: "Use this reset" })).toBeDisabled();
});
it("starts a new redemption after a confirmed no-op instead of replaying its cached result", async () => {
  mocks.consume.mockResolvedValue({ outcome: "nothing-to-reset" });
  renderWithI18n(
    <UsageResetCredits
      providerId="test"
      credits={{ status: "known", grants: [grant] }}
      now={now}
    />,
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    fireEvent.click(screen.getByRole("button", { name: "Use this reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Use reset" }));
    expect(await screen.findByRole("status")).toHaveTextContent("No eligible usage to reset yet.");
  }
  expect(mocks.consume).toHaveBeenCalledTimes(2);
  expect(mocks.consume.mock.calls[0]?.[0].requestId).not.toBe(
    mocks.consume.mock.calls[1]?.[0].requestId,
  );
});
it("updates the usage store when only inventory changes", () => {
  useProviderUsageStore.getState().setSnapshots([
    {
      providerId: "test",
      status: "ok",
      fetchedAt: 0,
      windows: [],
      resetCredits: { status: "known", grants: [] },
    },
  ]);
  useProviderUsageStore.getState().mergeSnapshot({
    providerId: "test",
    status: "ok",
    fetchedAt: 0,
    windows: [],
    resetCredits: { status: "known", grants: [grant] },
  });
  expect(useProviderUsageStore.getState().snapshots.test?.resetCredits).toEqual({
    status: "known",
    grants: [grant],
  });
});
