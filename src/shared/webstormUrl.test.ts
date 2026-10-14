import { describe, expect, it } from "vitest";
import { isWebstormFileUrl, webstormFileUrl } from "./webstormUrl";

describe("WebStorm file links", () => {
  it("round-trips spaces, Unicode, reserved characters and line numbers", () => {
    const path = "/Users/demo/żółć/file #1 & draft.png";
    const url = new URL(webstormFileUrl(path, 42));
    expect(isWebstormFileUrl(url)).toBe(true);
    expect(url.searchParams.get("file")).toBe(path);
    expect(url.searchParams.get("line")).toBe("42");
  });

  it.each([
    "webstorm://open?file=relative.txt",
    "webstorm://open?file=%00%2Ftmp%2Fx",
    "webstorm://open?file=%2Ftmp%2Fx&line=-1",
    "webstorm://open?file=%2Ftmp%2Fx&file=%2Ftmp%2Fy",
    "webstorm://open?file=%2Ftmp%2Fx&command=delete",
    "webstorm://delete?file=%2Ftmp%2Fx",
    "webstorm://user@open?file=%2Ftmp%2Fx",
    "file:///tmp/x",
    "javascript:alert(1)",
  ])("rejects unsupported route %s", (raw) => {
    expect(isWebstormFileUrl(new URL(raw))).toBe(false);
  });
});
