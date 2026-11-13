# Desktop remote connections

This fork supports desktop-to-desktop and desktop-to-headless connections. The mobile/PWA client and native mobile bridges are removed. Historical implementation notes are in [the archive](fork/archive/REMOTE_ARCHITECTURE.md); they describe retired mobile paths as well as older desktop work.

## Code map

- `src/shared/remote/`: shared HTTP/WebSocket schemas, protocol version, client, pairing and relay framing.
- `src/main/remote/`: desktop API server, authentication, pairing tokens, snapshots, runtime persistence, browser/port gateways and forwarding.
- `src/main/ssh/`: desktop SSH runtime deployment and management.
- `src/renderer/state/remoteServersStore.ts`: configured remote servers and desktop connection state.
- `src/renderer/state/remote/`: synchronization into desktop stores.
- `src/renderer/remoteProcedureRouter.ts`: routing desktop IPC operations to the correct host.
- `src/server/`: headless host and self-hostable relay.

The remote host owns agent processes and thread state. A desktop client consumes the same provider-agnostic protocol as the local renderer. Authentication uses scoped tokens; remote settings and commands remain validated at the server boundary.

## Desktop-only changes

The renderer build emits `index.html` only. `/pair` and `/app` show an endpoint information page; there is no bundled browser application, web manifest or service worker. HTTP/WebSocket API and SSH protocol versions are unchanged because their payloads are unchanged. Old shared settings are normalized per field; removed locale preferences fall back to system/en without resetting unrelated settings.

For API changes, follow [versioning](../.agents/docs/versioning.md). Check `src/main/remote/RemoteAccessServer.test.ts` and `DesktopRemoteAccessController.test.ts` for behavior. For running the headless host and relay, use the scripts in package.json and variables documented in `.env.example`.
