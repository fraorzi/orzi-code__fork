import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithI18n } from "@/renderer/testUtils/i18n";
import { UsageResetCredits } from "./UsageResetCredits";
import { useProviderUsageStore } from "@/renderer/state/providerUsageStore";

it("shows reset availability and a dated expiry, then removes expired credits from the count", () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  const credits = {
    status: "known",
    grants: [{ id: "one", remaining: 1, expiresAt: now + 60_000 }],
  } as const;
  const { rerender } = renderWithI18n(
    <UsageResetCredits credits={{ ...credits, grants: [...credits.grants] }} now={now} />,
  );
  expect(screen.getByText("Additional resets: 1")).toBeInTheDocument();
  expect(screen.getByText(/Expires .*2026/)).toBeInTheDocument();
  rerender(
    <UsageResetCredits credits={{ ...credits, grants: [...credits.grants] }} now={now + 60_000} />,
  );
  expect(screen.getByText("Additional resets: 0")).toBeInTheDocument();
  expect(screen.queryByText(/Expires /)).toBeNull();
});

it("shows unknown web-only availability without a zero count", () => {
  renderWithI18n(<UsageResetCredits credits={{ status: "unknown", reason: "web-only" }} now={0} />);
  expect(screen.getByText("Resets: check provider website")).toBeInTheDocument();
  expect(screen.queryByText(/Additional resets:/)).toBeNull();
});

it("updates the usage store when only the reset inventory changes", () => {
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
    resetCredits: { status: "known", grants: [{ id: "new", remaining: 1 }] },
  });
  expect(useProviderUsageStore.getState().snapshots.test?.resetCredits).toEqual({
    status: "known",
    grants: [{ id: "new", remaining: 1 }],
  });
});
