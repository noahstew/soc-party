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

Home shows only the `room-entry.tsx` admission card. Continue validates the player
name and flips to Connect/Create Room; editing the name preserves both fields.
Inactive faces are inert and hidden from assistive technology, focus follows the
active step, and reduced motion disables the flip transition. Admission success
uses the global success toast. Shared-link admission and session recovery remain
owned by `room-lobby.tsx`; no additional icon or animation dependency is needed.

The badge retains its slight tilt. The room face has a Back control above the
room-code field. Each face keeps its natural height; a ResizeObserver tracks the
active face so the outer card animates height with the flip, including viewport
or content resizing. Both transitions are disabled for reduced motion.

Active rooms use `/lobby?room=CODE`; generated invitations use this route too.
The invitation URL field is disabled; its trailing Copy URL button copies the
link with a global success toast, or an error toast if clipboard access fails.
Legacy `/?room=CODE` links are canonicalized to `/lobby`. A valid shared code
bypasses the room-code step: returning players join using their remembered name,
while first-time players enter a name and Continue joins directly. Names are
remembered in localStorage; credentials stay in tab sessionStorage. A matching
saved room reconnects before considering a new join, and a different shared code
takes precedence over the old room. Failed invitations return to editable
admission with the error toast. Leaving or a revoked session returns to `/`.
Native history replacement keeps one mounted controller/socket while changing
the URL; a direct visit or reload of `/lobby` renders that same controller and
recovers the session. Storage-disabled browsers can still enter their name.
