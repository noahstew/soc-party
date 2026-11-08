# Platform UI

`room-lobby.tsx` owns room admission and one WebSocket per mounted browser tab.
The Go protocol is mirrored in `src/lib/protocol.ts`. Public room views contain
player IDs/names/connection state; bearer tokens stay in tab sessionStorage.

Admission errors are visible. Reload uses HTTP reconnect and rotates the token;
transient socket disconnects retry the existing token up to three times. An
invalid/revoked session returns to admission. Storage-disabled browsers can play,
but cannot recover their credential after a reload. New tabs should join with a
fresh name; duplicating a tab may copy sessionStorage and replace its socket.

The Next server passes API_PUBLIC_URL to the client. API_INTERNAL_URL stays on
the server. For another device, set both the public backend URL and the exact
browser origin in ALLOWED_ORIGINS; Docker hostnames are never public URLs.
Tests mock fetch and WebSocket boundaries and assert rendered player outcomes.

The room game selector is visible to all members. Only the connected owner may
choose a game; `select_game` is authorized and validated by the Go actor. Zinger is
the only available choice. Coming soon stays disabled and is rejected by the server.
