// Modified for the orzi-code__fork personal fork by Franciszek Orzechowski on 2026-10-06.
export type PoracodeChannel = "stable" | "nightly";

export const PORACODE_CHANNELS: readonly PoracodeChannel[] = ["stable", "nightly"];

declare const __PORACODE_CHANNEL__: string | undefined;

export function normalizeChannel(value: unknown): PoracodeChannel {
  return value === "nightly" ? "nightly" : "stable";
}

export function resolvePoracodeChannel(): PoracodeChannel {
  return normalizeChannel(typeof __PORACODE_CHANNEL__ === "string" ? __PORACODE_CHANNEL__ : "");
}

export function productNameFor(channel: PoracodeChannel): string {
  return channel === "nightly" ? "Orzi Code Nightly" : "Orzi Code";
}

/** Persistent Electron identity: macOS derives the safeStorage Keychain service from this name. */
export function electronAppNameFor(channel: PoracodeChannel): string {
  return channel === "nightly" ? "Poracode Personal Nightly" : "Poracode Personal";
}

export function appIdFor(channel: PoracodeChannel): string {
  // Personal fork must not share application identity with upstream.
  return channel === "nightly"
    ? "com.franciszek.poracode.personal.nightly"
    : "com.franciszek.poracode.personal";
}

export function userDataDirNameFor(channel: PoracodeChannel): string {
  return channel === "nightly" ? ".poracode-personal-nightly" : ".poracode-personal";
}

export function updaterChannelFor(channel: PoracodeChannel): string | undefined {
  return channel === "nightly" ? "nightly" : undefined;
}

export function artifactPrefixFor(channel: PoracodeChannel): string {
  return channel === "nightly" ? "Orzi-Code-Nightly" : "Orzi-Code";
}
