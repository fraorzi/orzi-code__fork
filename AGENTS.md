<!-- Personal fork maintained by Franciszek Orzechowski. -->

# Orzi Code

Desktop Electron fork of Poracode. Read [the current handoff](docs/fork/HANDOFF.md) before implementation, status review, or packaging. Read historical documents only when the task needs them.

## Fork scope

- Desktop only. Mobile/PWA, iOS/Android, native mobile bridges, mobile builds and mobile QA are outside this fork.
- Ship only English (`en`, source) and Polish (`pl`). Every changed renderer string must be localized with Lingui and translated into Polish.
- Preserve desktop providers, SSH/WSL, browser tools, computer-use, teams, history and local updates. Removing another feature requires a user request.
- `website/` is a separate project with its own lockfile and checks. Work there only for an explicit website task; desktop installation, lint and formatting exclude it.
- Preserve existing worktree and index changes. Keep scratch files under `tmp/` or `.tmp/`.
- Respond concisely in Polish. Use only ASCII hyphen-minus (-), never typographic dashes.
- Prefer inline expressions for simple single-use values. Extract values when reuse, domain meaning, readability, cost or typing warrants it.
- If a build requires internet and access is unavailable, do not run it.

## Commands

Use pnpm pinned in `package.json` and Node >= 24.10.0. Scripts in `package.json` are authoritative.

- Typecheck: `pnpm run typecheck`.
- Lint: `pnpm run lint` (oxlint plus type-aware lint).
- Format: `pnpm run fmt:check` / `pnpm exec oxfmt --write <files>`.
- Targeted tests: `pnpm exec vitest run <files>`. Full tests: `pnpm run test`.
- Development: `pnpm run dev`. Build/package: `pnpm run build`, then `pnpm run dist`.
- Focused changes need nearby tests and touched-file lint/format. When asked to fix all checks, make typecheck, lint and tests green.

## Architecture constraints

- Terminal threads use real PTYs; GUI threads use structured provider runtimes. The active presentation is authoritative. Only the supervisor owns agent processes.
- Shared runtime and UI are provider-agnostic. Declare named capabilities in provider plugins; parse vendor payloads behind provider hooks. Before provider-related changes to shared files, read [provider isolation](.agents/docs/agent-adapters.md#provider-isolation--hard-rules).
- Trace runtime/chat symptoms through real thread state before editing display code. Investigate render invalidation, measurement loops and sync I/O for performance bugs.
- React Compiler handles memoization. Add `useMemo`, `useCallback` or `React.memo` only as a deliberate compiler escape. Keep its Babel plugin exactly pinned.
- Use HeroUI v3 for non-terminal UI; load the `heroui-react` skill first. Follow local UI conventions and keep visual scope tight. Put absolute tooltip positioning on an out-of-flow wrapper around a normally positioned `Tooltip.Trigger`.
- Split complex files by responsibility. With `exactOptionalPropertyTypes`, use conditional spreads instead of explicit undefined optional props.
- Windows projects retain native cwd. WSL commands use `wsl.exe -d <distro> --cd <linuxPath> --exec <command>`.
- Changes to persisted state, caches, manifests, IPC/wire protocols or deployed plugins require a version/migration audit, including mirrored copies and an upgrade regression test. Read [versioning](.agents/docs/versioning.md) for those changes.

## Internationalization (i18n)

Lingui scans `src/renderer` only. Catalogs: `src/renderer/locales/{en,pl}/messages.po`.

1. JSX text uses `<Trans>`, component strings use `t` from `useLingui()`, module labels use `msg`, actions use `i18n._(msg...)`.
2. Main/supervisor messages use a key in `src/shared/messages.ts` and a descriptor in `src/renderer/i18n/sharedMessages.ts`.
3. Run `pnpm i18n:extract`, fill new Polish `msgstr`, and re-extract. Both locales must report 0 missing. After removing strings, use `pnpm i18n:extract:clean`.
4. Preserve literal product/provider names, `WSL` and `.poracode/worktrees`. Run typecheck and touched-file lint.

Macro examples and terminology: [i18n reference](.agents/docs/i18n.md).

## Read when relevant

- Structure: [architecture](.agents/docs/architecture.md).
- Providers: [adapter rules](.agents/docs/agent-adapters.md).
- UI: [patterns](.agents/docs/ui-patterns.md), [React editing](.agents/docs/editing-rules.md).
- Computer use: [native helper and testing](.agents/docs/computer-use.md).
- Runtime/UI verification: `interactive-testing` and `provider-chat-smoke` skills under `.agents/skills/`.
