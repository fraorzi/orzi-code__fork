import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, ProjectLocation } from "@/shared/contracts";
import type { PoracodeBridge } from "@/shared/ipc";
import { HOME_PROJECT_ID } from "@/shared/homeScope";
import { useFileEditorStore } from "@/renderer/state/fileEditorStore";
import { buildFileEditorContext } from "@/renderer/utils/gitHelpers";
import { createChatPaneFileActions } from "./chatPaneFileActions";

const readExternalFile = vi.fn<PoracodeBridge["readExternalFile"]>(async ({ absolutePath }) => ({
  path: absolutePath,
  status: "binary" as const,
  modifiedAtMs: 1,
  contentBase64: "JVBERi0xLjQ=",
}));
const openExternalNative = vi.fn<PoracodeBridge["openExternalNative"]>(async () => {});
const readProjectFile = vi.fn<PoracodeBridge["readProjectFile"]>();
const searchProjectFiles = vi.fn<PoracodeBridge["searchProjectFiles"]>(async () => ({
  totalIndexed: 1,
  entries: [{ type: "file", name: "report.pdf", path: "output/report.pdf" }],
}));

function homeProject(location: ProjectLocation): Project {
  return { id: HOME_PROJECT_ID, name: "Home", location, createdAt: "2026-09-18T00:00:00Z" };
}

beforeEach(() => {
  vi.clearAllMocks();
  useFileEditorStore.getState().clearSession();
  Object.defineProperty(window, "poracode", {
    configurable: true,
    value: { readExternalFile, readProjectFile, searchProjectFiles, openExternalNative },
  });
});

describe("Home file actions", () => {
  it.each([
    [
      { kind: "windows", path: "C:/Users/test" },
      "D:\\OneDrive\\CV for phd\\cv.pdf",
      "D:/OneDrive/CV for phd/cv.pdf",
    ],
    [
      { kind: "windows", path: "C:/Users/test" },
      "C:/Users/test/Documents/cv.pdf",
      "C:/Users/test/Documents/cv.pdf",
    ],
    [
      { kind: "windows", path: "C:/Users/test" },
      "\\\\server\\share\\cv.pdf",
      "//server/share/cv.pdf",
    ],
    [{ kind: "posix", path: "/home/test" }, "/tmp/cv.pdf", "/tmp/cv.pdf"],
    [{ kind: "posix", path: "/home/test" }, "~/Documents/cv.pdf", "~/Documents/cv.pdf"],
    [{ kind: "posix", path: "/home/test" }, "/home/TEST/report.md", "/home/TEST/report.md"],
    [
      { kind: "posix", path: "/home/test" },
      "/home/test/report\\draft.md ",
      "/home/test/report\\draft.md ",
    ],
    [{ kind: "posix", path: "/home/test" }, "Documents/cv.pdf", "/home/test/Documents/cv.pdf"],
    [
      { kind: "posix", path: "/home/test" },
      "Documents/report\\draft.md ",
      "/home/test/Documents/report\\draft.md ",
    ],
    [
      { kind: "windows", path: "C:/Users/test" },
      "Documents/cv.pdf",
      "C:/Users/test\\Documents\\cv.pdf",
    ],
    [
      { kind: "windows", path: "C:/Users/test" },
      "file://server/share/CV%20draft.pdf",
      "//server/share/CV draft.pdf",
    ],
    [
      { kind: "windows", path: "C:/Users/test" },
      "file:///D:/Documents/CV%20draft.pdf",
      "D:/Documents/CV draft.pdf",
    ],
    [
      { kind: "posix", path: "/home/test" },
      "file:///home/TEST/report%5Cdraft.md%20",
      "/home/TEST/report\\draft.md ",
    ],
  ] satisfies Array<[ProjectLocation, string, string]>)(
    "opens %s reference %s in the desktop editor or host-aware fallback",
    async (location, path, expectedPath) => {
      const project = homeProject(location);
      const actions = createChatPaneFileActions({
        project,
        targetContext: buildFileEditorContext(project),
      });
      await actions.openProjectRelativePath!(path);
      const url = new URL(openExternalNative.mock.calls[0]![0]);
      expect(url.protocol).toBe("webstorm:");
      expect(url.hostname).toBe("open");
      expect(url.searchParams.get("file")).toBe(expectedPath);
      expect(readExternalFile).not.toHaveBeenCalled();
      expect(useFileEditorStore.getState().rootContext).toBeNull();
      expect(readProjectFile).not.toHaveBeenCalled();
      expect(searchProjectFiles).not.toHaveBeenCalled();
      expect(actions.revealProjectFolderInTree).toBeUndefined();
      expect(actions.showProjectEntryInExplorer).toBeUndefined();
      expect(actions.projectLocation).toBeUndefined();
      expect(actions.projectRootNames).toBeUndefined();
    },
  );

  it.each([
    [
      {
        kind: "wsl",
        distro: "Ubuntu",
        linuxPath: "/home/test",
        uncPath: "\\\\wsl.localhost\\Ubuntu\\home\\test",
      },
      "/tmp/cv.pdf",
      "/tmp/cv.pdf",
    ],
    [
      {
        kind: "wsl",
        distro: "Ubuntu",
        linuxPath: "/home/test",
        uncPath: "\\\\wsl.localhost\\Ubuntu\\home\\test",
      },
      "/home/TEST/report\\draft.md ",
      "/home/TEST/report\\draft.md ",
    ],
  ] satisfies Array<[ProjectLocation, string, string]>)(
    "preserves WSL file handling for %s, %s",
    async (location, path, expectedPath) => {
      const project = homeProject(location);
      const actions = createChatPaneFileActions({
        project,
        targetContext: buildFileEditorContext(project),
      });
      await actions.openProjectRelativePath!(path);
      expect(openExternalNative).not.toHaveBeenCalled();
      expect(readExternalFile).toHaveBeenCalledExactlyOnceWith({
        projectLocation: location,
        absolutePath: expectedPath,
      });
      expect(useFileEditorStore.getState().buffers[expectedPath]?.status).toBe("binary");
    },
  );

  it("routes mobile file opens to the caller with the absolute path and line", async () => {
    const project = homeProject({ kind: "posix", path: "/home/test" });
    const onOpenProjectRelativePath = vi.fn<(path: string, lineNumber?: number) => void>();
    const actions = createChatPaneFileActions({
      project,
      targetContext: buildFileEditorContext(project),
      onOpenProjectRelativePath,
    });
    await actions.openProjectRelativePath!("Documents/notes.md", 12);
    expect(onOpenProjectRelativePath).toHaveBeenCalledExactlyOnceWith(
      "/home/test/Documents/notes.md",
      12,
    );
    expect(readExternalFile).not.toHaveBeenCalled();
    expect(useFileEditorStore.getState().rootContext).toBeNull();
  });

  it("does not send a remote Home path to the local editor", () => {
    const project = {
      ...homeProject({ kind: "posix", path: "/home/test" }),
      remoteServerId: "server",
    };
    const actions = createChatPaneFileActions({
      project,
      targetContext: buildFileEditorContext(project),
    });
    expect(actions.openProjectRelativePath).toBeUndefined();
    expect(readExternalFile).not.toHaveBeenCalled();
  });

  it("opens a nested basename and line in WebStorm", async () => {
    const project = { ...homeProject({ kind: "posix", path: "/repo" }), id: "project" };
    const actions = createChatPaneFileActions({
      project,
      targetContext: buildFileEditorContext(project),
    });
    await actions.openProjectRelativePath!("report.pdf", 3);
    expect(openExternalNative).toHaveBeenCalledExactlyOnceWith(
      "webstorm://open?file=%2Frepo%2Foutput%2Freport.pdf&line=3",
    );
  });

  it("keeps project basename lookup and relative routing", async () => {
    const project = { ...homeProject({ kind: "posix", path: "/repo" }), id: "project" };
    const onOpenProjectRelativePath = vi.fn<(path: string, lineNumber?: number) => void>();
    const actions = createChatPaneFileActions({
      project,
      targetContext: buildFileEditorContext(project),
      onOpenProjectRelativePath,
    });
    await actions.openProjectRelativePath!("report.pdf", 3);
    expect(searchProjectFiles).toHaveBeenCalledExactlyOnceWith({
      projectLocation: project.location,
      query: "report.pdf",
      limit: 5,
    });
    expect(onOpenProjectRelativePath).toHaveBeenCalledExactlyOnceWith("output/report.pdf", 3);
    expect(actions.revealProjectFolderInTree).toBeTypeOf("function");
  });
});
