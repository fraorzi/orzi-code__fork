<!-- Modified for the orzi-code__fork personal fork by Franciszek Orzechowski on 2026-10-06. -->

# orzi-code__fork

Personal macOS fork of [Poracode](https://github.com/Porabuild/Poracode), maintained by Franciszek Orzechowski. This repository publishes the fork source code. The desktop application uses the name `Orzi Code`.

Fork features and verification are recorded in [the implementation status](docs/fork/implementation.md). Before developing this checkout, read [the handoff](docs/fork/HANDOFF.md).

The upstream Apache-2.0 license and author notices are preserved. Bundled Geist fonts retain their [OFL-1.1 license](src/renderer/fonts/OFL.txt). Provider SDKs and native dependencies keep their own terms; publishing source code does not establish permission to distribute every bundled binary. See [NOTICE](NOTICE) and [the licensing findings](docs/fork/research.md#publiczne-repozytorium-i-licencje).

## Development

Desktop Electron application, English and Polish. Mobile/PWA and native iOS/Android targets are removed from this fork. All desktop providers and SSH/WSL features remain available.

Use Node >= 24.10.0 and the pnpm version pinned in package.json. Run `pnpm install`, then `pnpm run dev`. Checks: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`. Build: `pnpm run build`; packaging: `pnpm run dist`.

Agent instructions are in [AGENTS.md](AGENTS.md). The [upstream repository](https://github.com/Porabuild/Poracode) describes the original product.

The optional `website/` project has its own workspace and lockfile. Install and check it separately with `pnpm --dir website install`; desktop setup and checks exclude it.
