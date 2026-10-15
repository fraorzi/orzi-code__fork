import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/shared/contracts";
import { HOME_PROJECT_ID, HOME_PROJECT_NAME } from "@/shared/homeScope";
import { dynamicActivate } from "@/renderer/i18n/i18n";
import { useAppStore } from "@/renderer/state/appStore";
import { useSharedSettings } from "@/renderer/state/sharedSettingsStore";
import { useSidebarUiStore } from "@/renderer/state/sidebarUiStore";
import { renderWithI18n as render } from "@/renderer/testUtils/i18n";
import { SidebarHomeSection } from "./SidebarHomeSection";

vi.mock("@/renderer/bridge", () => ({ readBridge: () => ({}) }));
vi.mock("@dnd-kit/react", () => ({ useDraggable: () => undefined }));
vi.mock("./SidebarProjectThreadList", () => ({ SidebarProjectThreadList: () => null }));

const project: Project = {
  id: HOME_PROJECT_ID,
  name: HOME_PROJECT_NAME,
  location: { kind: "posix", path: "/home/test" },
  disabled: true,
  createdAt: "2026-10-15T00:00:00.000Z",
};

beforeEach(() => {
  useAppStore.setState({ projects: [project], threads: [], view: { kind: "home" } });
  useSharedSettings.setState({ newThreadMode: "page" });
  useSidebarUiStore.setState({ collapsedProjects: { [project.id]: true } });
});
afterEach(async () => dynamicActivate("en"));

describe("SidebarHomeSection", () => {
  it.each(["click", "Enter", " "])(
    "opens a Home draft with %s without toggling the section",
    async (action) => {
      render(<SidebarHomeSection project={project} sortMode="updated" />);
      const plus = screen.getByRole("button", { name: "New thread in Home" });
      if (action === "click") fireEvent.click(plus);
      else fireEvent.keyDown(plus, { key: action });
      await waitFor(() =>
        expect(useAppStore.getState().view).toEqual({ kind: "draft", projectId: project.id }),
      );
      expect(useSidebarUiStore.getState().collapsedProjects[project.id]).toBe(true);
    },
  );

  it("uses the localized Home name in its label and actions", async () => {
    await dynamicActivate("pl");
    render(<SidebarHomeSection project={project} sortMode="updated" />);
    expect(screen.getByText("Strona główna")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nowy wątek w Strona główna" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminal dla Strona główna" })).toBeInTheDocument();
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });
});
