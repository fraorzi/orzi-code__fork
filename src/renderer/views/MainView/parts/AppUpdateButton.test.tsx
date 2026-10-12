import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithI18n } from "@/renderer/testUtils/i18n";
import { useUpdateStore } from "@/renderer/state/updateStore";

const installUpdate = vi.hoisted(() => vi.fn<() => Promise<void>>());
vi.mock("@/renderer/bridge", () => ({ readBridge: () => ({ installUpdate }) }));

import { AppUpdateButton } from "./AppUpdateButton";

beforeEach(() => {
  useUpdateStore.getState().setNotAvailable();
  installUpdate.mockReset().mockResolvedValue(undefined);
});

it("appears only after download and disappears when the update is no longer ready", () => {
  renderWithI18n(<AppUpdateButton />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  act(() => useUpdateStore.getState().beginUpdateDownload("1.8.1"));
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  act(() => useUpdateStore.getState().setDownloaded("1.8.1"));
  expect(screen.getByRole("button", { name: "Update and restart" })).toBeEnabled();
  act(() => useUpdateStore.getState().setNotAvailable());
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("uses the existing installer when the update action is pressed", () => {
  useUpdateStore.getState().setDownloaded("1.8.1");
  renderWithI18n(<AppUpdateButton />);
  fireEvent.click(screen.getByRole("button", { name: "Update and restart" }));
  expect(installUpdate).toHaveBeenCalledOnce();
});
