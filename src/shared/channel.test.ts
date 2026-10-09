// Modified for the orzi-code__fork personal fork by Franciszek Orzechowski on 2026-10-06.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appIdFor,
  artifactPrefixFor,
  PORACODE_CHANNELS,
  productNameFor,
  electronAppNameFor,
  updaterChannelFor,
  userDataDirNameFor,
} from "./channel";

describe("channel", () => {
  it("enumerates exactly stable and nightly", () => {
    expect(PORACODE_CHANNELS).toEqual(["stable", "nightly"]);
  });

  it("returns the right product names", () => {
    expect(productNameFor("stable")).toBe("Orzi Code");
    expect(productNameFor("nightly")).toBe("Orzi Code Nightly");
  });

  it("preserves the previous Electron name and Keychain namespace across the public rename", () => {
    expect(electronAppNameFor("stable")).toBe("Poracode Personal");
    expect(electronAppNameFor("nightly")).toBe("Poracode Personal Nightly");
  });

  it("returns the right app ids", () => {
    expect(appIdFor("stable")).toBe("com.franciszek.poracode.personal");
    expect(appIdFor("nightly")).toBe("com.franciszek.poracode.personal.nightly");
  });

  it("returns the right user data dir names", () => {
    expect(userDataDirNameFor("stable")).toBe(".poracode-personal");
    expect(userDataDirNameFor("nightly")).toBe(".poracode-personal-nightly");
  });

  it("only returns a published channel name for nightly", () => {
    expect(updaterChannelFor("stable")).toBeUndefined();
    expect(updaterChannelFor("nightly")).toBe("nightly");
  });

  it("returns artifact prefixes that are distinct between channels", () => {
    expect(artifactPrefixFor("stable")).toBe("Orzi-Code");
    expect(artifactPrefixFor("nightly")).toBe("Orzi-Code-Nightly");
    expect(artifactPrefixFor("stable")).not.toBe(artifactPrefixFor("nightly"));
  });
});

describe("resolvePoracodeChannel", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("defaults to stable when __PORACODE_CHANNEL__ is unset", async () => {
    vi.resetModules();
    const mod = await import("./channel");
    expect(mod.resolvePoracodeChannel()).toBe("stable");
  });

  it("returns nightly when the build-time constant is 'nightly'", async () => {
    vi.resetModules();
    vi.stubGlobal("__PORACODE_CHANNEL__", "nightly");
    const mod = await import("./channel");
    expect(mod.resolvePoracodeChannel()).toBe("nightly");
    vi.unstubAllGlobals();
  });

  it("falls back to stable for any unknown value", async () => {
    vi.resetModules();
    vi.stubGlobal("__PORACODE_CHANNEL__", "beta");
    const mod = await import("./channel");
    expect(mod.resolvePoracodeChannel()).toBe("stable");
    vi.unstubAllGlobals();
  });
});
