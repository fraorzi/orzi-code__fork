import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { PoracodeBridge } from "@/shared/ipc";
import { renderWithI18n } from "@/renderer/testUtils/i18n";
import { useProviderUsageStore } from "@/renderer/state/providerUsageStore";
import { useSidebarUiStore } from "@/renderer/state/sidebarUiStore";
import { ProviderUsageRows } from "./ProviderUsageRows";

const mocks = vi.hoisted(() => ({ createTab: vi.fn<PoracodeBridge["browserCreateTab"]>() }));
vi.mock("@/renderer/bridge", () => ({
  isRemoteSession: () => false,
  readBridge: () => ({ browserCreateTab: mocks.createTab }),
}));
vi.mock("./providerManifest", () => ({
  getProviderManifest: (id: string) =>
    id === "test"
      ? { kind: "test", usageResetUrl: "https://example.com/settings/usage" }
      : undefined,
}));
vi.mock("./useUsageProviderLogin", () => ({
  useUsageProviderLogin: () => ({ signingIn: false, handleSignIn: async () => {} }),
}));
const now = Date.now();
beforeEach(() => {
  useSidebarUiStore.setState({ limitsExpanded: false });
  useProviderUsageStore.getState().setSnapshots([
    {
      providerId: "test",
      status: "ok",
      fetchedAt: now,
      windows: [{ id: "weekly", label: "Weekly", usedPercent: 75, unit: "percent" }],
      resetCredits: {
        status: "known",
        grants: [
          {
            id: "bonus",
            label: "Urgent reset",
            remaining: 1,
            expiresAt: now + 60_000,
            canActivate: true,
          },
        ],
      },
    },
  ]);
});
it("shows a compact count and expiry warning above collapsed limits, with details on demand", async () => {
  renderWithI18n(<ProviderUsageRows providers={[{ id: "test", label: "Test" }]} />);
  const section = screen.getByRole("region", { name: "Saved resets" });
  expect(within(section).getByText("1")).toBeVisible();
  expect(within(section).getByLabelText("Use before expiry")).toBeVisible();
  expect(screen.queryByText("Urgent reset")).toBeNull();
  const limits = screen.getByRole("button", { name: "Expand limits" });
  expect(limits).toHaveAttribute("aria-expanded", "false");
  expect(section.compareDocumentPosition(limits) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Saved resets for Test" }));
  expect(await screen.findByText("Urgent reset")).toBeVisible();
  expect(screen.getByRole("button", { name: "Use this reset" })).toBeVisible();
  expect(document.querySelectorAll("button button")).toHaveLength(0);
});
it("opens an unreadable inventory inside Orzi without implying a zero count", async () => {
  useProviderUsageStore.getState().mergeSnapshot({
    providerId: "test",
    status: "ok",
    fetchedAt: now,
    windows: [],
    resetCredits: { status: "unknown", reason: "web-only" },
  });
  renderWithI18n(<ProviderUsageRows providers={[{ id: "test", label: "Test" }]} />);
  expect(screen.queryByText("0")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Saved resets for Test" }));
  fireEvent.click(await screen.findByRole("button", { name: "Open usage in Orzi" }));
  expect(mocks.createTab).toHaveBeenCalledWith({
    url: "https://example.com/settings/usage",
    activate: true,
    reveal: true,
  });
});
it("does not add a saved-reset section for a provider without that capability", () => {
  renderWithI18n(<ProviderUsageRows providers={[{ id: "other", label: "Other" }]} />);
  expect(screen.queryByRole("region", { name: "Saved resets" })).toBeNull();
});
