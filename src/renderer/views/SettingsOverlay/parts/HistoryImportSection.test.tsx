import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoracodeBridge } from "@/shared/ipc";
import { projectSchema, threadSchema } from "@/shared/contracts";
import { useAppStore } from "@/renderer/state/appStore";
import { renderWithI18n as render } from "@/renderer/testUtils/i18n";
import { HistoryImportSection } from "./HistoryImportSection";

const mocks = vi.hoisted(() => ({
  pickFiles: vi.fn<PoracodeBridge["pickFiles"]>(),
  prepareHistoryImport: vi.fn<PoracodeBridge["prepareHistoryImport"]>(),
  applyHistoryImport: vi.fn<PoracodeBridge["applyHistoryImport"]>(),
  cancelHistoryImport: vi.fn<PoracodeBridge["cancelHistoryImport"]>(),
  dbGetProjects: vi.fn<PoracodeBridge["dbGetProjects"]>(),
  dbGetThreads: vi.fn<PoracodeBridge["dbGetThreads"]>(),
  remote: vi.fn<() => boolean>(() => false),
}));
vi.mock("@/renderer/bridge", () => ({ readBridge: () => mocks, isRemoteSession: mocks.remote }));
const preview = {
  token: "c8ba2ea9-02e7-482a-9bbd-2fc5b1e95fb0",
  sourcePath: "/source/state.sqlite",
  newProjects: 1,
  newThreads: 2,
  skippedThreads: 3,
  attachments: 1,
};
const project = projectSchema.parse({
  id: "project",
  name: "Project",
  location: { kind: "posix", path: "/project" },
  createdAt: "2026-01-01",
});
const localThread = threadSchema.parse({
  id: "local",
  projectId: project.id,
  title: "Live local title",
  agentKind: "codex",
  config: { model: "reasoning" },
  status: "working",
  attention: "working",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.remote.mockReturnValue(false);
  mocks.pickFiles.mockResolvedValue([preview.sourcePath]);
  mocks.prepareHistoryImport.mockResolvedValue({ ok: true, value: preview });
  mocks.applyHistoryImport.mockResolvedValue({
    ok: true,
    value: { projects: 1, threads: 2, attachments: 1, backupPath: "/target/backup/state.sqlite" },
  });
  mocks.cancelHistoryImport.mockResolvedValue(undefined);
  mocks.dbGetProjects.mockResolvedValue([project]);
  mocks.dbGetThreads.mockResolvedValue([localThread]);
  useAppStore.setState({ projects: [project], threads: [localThread] });
});

describe("history import review", () => {
  it("shows the selection before writing, and cancellation releases its review ticket", async () => {
    render(<HistoryImportSection />);
    fireEvent.click(screen.getByRole("button", { name: "Choose history database" }));
    await screen.findByText("Existing threads skipped");
    expect(mocks.applyHistoryImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(mocks.cancelHistoryImport).toHaveBeenCalledWith({ token: preview.token }),
    );
    expect(screen.queryByRole("button", { name: "Import new threads" })).toBeNull();
  });
  it("imports through the reviewed ticket and preserves live state while adding new rows", async () => {
    const imported = {
      ...localThread,
      id: "new-thread",
      title: "Imported",
      status: "inactive" as const,
      attention: "none" as const,
    };
    mocks.dbGetThreads.mockResolvedValue([{ ...localThread, title: "Stale DB title" }, imported]);
    render(<HistoryImportSection />);
    fireEvent.click(screen.getByRole("button", { name: "Choose history database" }));
    fireEvent.click(await screen.findByRole("button", { name: "Import new threads" }));
    await screen.findByText("History imported.");
    expect(mocks.applyHistoryImport).toHaveBeenCalledWith({ token: preview.token });
    expect(useAppStore.getState().threads).toEqual([localThread, imported]);
    expect(screen.getByText(/\/target\/backup\/state.sqlite/)).toBeTruthy();
  });
  it("reports a stale preview and hides device-owned import in remote sessions", async () => {
    mocks.applyHistoryImport.mockResolvedValue({ ok: false, reason: "stalePreview" });
    const view = render(<HistoryImportSection />);
    fireEvent.click(screen.getByRole("button", { name: "Choose history database" }));
    fireEvent.click(await screen.findByRole("button", { name: "Import new threads" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The history changed");
    view.unmount();
    mocks.remote.mockReturnValue(true);
    render(<HistoryImportSection />);
    expect(screen.queryByRole("button", { name: "Choose history database" })).toBeNull();
  });
});
