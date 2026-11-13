import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PoracodeBridge } from "@/shared/ipc";
import { renderWithI18n as render } from "@/renderer/testUtils/i18n";
import { useLocalPortsStore } from "@/renderer/state/localPortsStore";
import { LocalPortsOverlay } from "./LocalPortsOverlay";

const bridge = vi.hoisted(() => ({
  listLocalPorts: vi.fn<PoracodeBridge["listLocalPorts"]>(),
  stopLocalPort: vi.fn<PoracodeBridge["stopLocalPort"]>(),
  openExternal: vi.fn<PoracodeBridge["openExternal"]>(),
}));
vi.mock("@/renderer/bridge", () => ({ readBridge: () => bridge, isRemoteSession: () => false }));
const port = {
  pid: 1234,
  startedAt: "Sat Oct 17 12:34:56 2026",
  port: 3000,
  address: "127.0.0.1",
  processName: "node",
  cwd: "/fixture",
};

beforeEach(() => {
  bridge.listLocalPorts.mockResolvedValue({ status: "available", ports: [port] });
  bridge.stopLocalPort.mockResolvedValue({ status: "stopped" });
  useLocalPortsStore.setState({ open: true });
});
afterEach(() => {
  useLocalPortsStore.setState({ open: false });
  vi.restoreAllMocks();
});

it("opens a server and stops only the reviewed process identity, then refreshes", async () => {
  render(<LocalPortsOverlay />);
  fireEvent.click(await screen.findByRole("button", { name: "Open http://127.0.0.1:3000" }));
  expect(bridge.openExternal).toHaveBeenCalledWith("http://127.0.0.1:3000");
  bridge.listLocalPorts.mockResolvedValue({ status: "available", ports: [] });
  fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  await screen.findByText("No running servers found.");
  expect(bridge.stopLocalPort).toHaveBeenCalledExactlyOnceWith({
    pid: port.pid,
    startedAt: port.startedAt,
    port: port.port,
  });
});

it("requires a second explicit action to force a server that ignores graceful stop", async () => {
  bridge.stopLocalPort.mockResolvedValueOnce({ status: "error", reason: "still-running" });
  render(<LocalPortsOverlay />);
  fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
  const force = await screen.findByRole("button", { name: "Force stop" });
  expect(bridge.stopLocalPort).toHaveBeenCalledTimes(1);
  fireEvent.click(force);
  await waitFor(() =>
    expect(bridge.stopLocalPort).toHaveBeenLastCalledWith({
      pid: port.pid,
      startedAt: port.startedAt,
      port: port.port,
      force: true,
    }),
  );
});

it("discards an in-flight scan when the dialog closes and reopens", async () => {
  let resolveOld: (value: Awaited<ReturnType<PoracodeBridge["listLocalPorts"]>>) => void = () => {};
  bridge.listLocalPorts.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve;
    }),
  );
  render(<LocalPortsOverlay />);
  await waitFor(() => expect(bridge.listLocalPorts).toHaveBeenCalled());
  act(() => useLocalPortsStore.getState().setOpen(false));
  act(() => useLocalPortsStore.getState().setOpen(true));
  await screen.findByText("http://127.0.0.1:3000");
  await act(async () => resolveOld({ status: "available", ports: [] }));
  expect(screen.getByText("http://127.0.0.1:3000")).toBeInTheDocument();
});

it("shows permission refusal without escalating privileges", async () => {
  bridge.stopLocalPort.mockResolvedValue({ status: "error", reason: "permission-denied" });
  render(<LocalPortsOverlay />);
  fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
  await screen.findByText("This process cannot be stopped with your current permissions.");
  expect(screen.queryByRole("button", { name: "Force stop" })).not.toBeInTheDocument();
});
