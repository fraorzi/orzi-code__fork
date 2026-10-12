// Modified for the orzi-code__fork personal fork by Franciszek Orzechowski on 2026-10-09.
// Explicit feed ownership prevents packaging from inferring the upstream remote.
function releasePublishYaml(channel) {
  return `publish:
  provider: github
  owner: fraorzi
  repo: orzi-code__fork
  private: false
  channel: ${channel === "nightly" ? "nightly" : "latest"}`;
}

function validateReleaseSigning(platform, releaseSigning, env) {
  if (!releaseSigning) return;
  if (platform !== "mac") {
    throw new Error("--release-signing is only supported for macOS.");
  }
  for (const key of [
    "CSC_LINK",
    "CSC_KEY_PASSWORD",
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
  ]) {
    if (!env[key]?.trim()) throw new Error(`Signed release requires ${key}.`);
  }
}

function macSigningYaml(releaseSigning, localIdentity) {
  // Local packages reuse the personal certificate when configured. Release CI
  // must use Developer ID and notarization; never substitute the local identity.
  return releaseSigning
    ? "  forceCodeSigning: true\n  notarize: true"
    : `${localIdentity ? '  forceCodeSigning: true\n  timestamp: "none"\n' : ""}  identity: ${JSON.stringify(localIdentity ?? "-")}\n  notarize: false`;
}

module.exports = { releasePublishYaml, validateReleaseSigning, macSigningYaml };
