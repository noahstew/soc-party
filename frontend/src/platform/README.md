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
choose a game or toggle packs; the Go actor validates each intent against the
registered catalog. Zinger is currently registered with published packs loaded
from the game database, including OG and Extended. New game registrations supply
their own catalog source; frontend rendering and room storage accept their IDs.

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
The SVG copy icon beside the large room code copies the canonical invitation URL
with global success/error toasts. Room settings do not repeat the code.
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

`lobby-view.tsx` renders the active room below the shared `components/brand.tsx`
badge. At 768px and wider, a vertical divider separates players from Room/Game
settings. Mobile starts on Lobby and exposes Room and Game as sibling tabs.
Arrow keys, Home and End navigate the tabs; resizing preserves the selected
settings. The local player stays above a scrollable list of other players.
A crown marks the current owner for all members, connected count excludes offline
members, and only the connected owner can remove others or change settings.
Room size uses the shared Base UI Select and stays visible but disabled for guests.
The footer contains only right-aligned Leave/reconnect controls outside the tabs. Existing room admission, socket and storage behavior is retained.

Game/pack tiles use text placeholders for future art. `components/choice-grid.tsx`
renders catalog entries in a focusable scroll region with a two-column grid and
bounded height. One disabled Coming Soon button is the final tile inside each
grid, matching the other choices and scrolling with them. Long titles wrap.

Each lobby projection supplies `games` (IDs, titles, and available pack slugs/titles)
and `selectedPackSlugs`. There is no fixed frontend game/pack count. A green circle
check marks selected tiles. Only the connected owner can send `select_game` or
`select_pack`; pack intents include the current `gameId` to reject stale clicks
from a different game. Clients render authoritative updates and can select multiple
packs. Switching games clears incompatible selections; reselecting the same game
preserves selection. The server requires three connected players and at least one
available selected pack for `canStart`. Choices refresh at room creation, socket
subscription, reconnect and selection; unavailable packs are removed on refresh.
The first catalog game/pack is selected for new rooms (currently Zinger/OG).

Published packs appear automatically on catalog refresh, without adding frontend
buttons. Registered game metadata is supplied in `backend/cmd/server/main.go`;
actual game modules, prompt sampling and gameplay start remain later milestones.

Lobby snapshots are compared by player ID to announce new members through the
shared info toast on every existing client. Initial admission seeds the baseline;
existing roster members, connection-status changes and unchanged reconnect
snapshots are not announced again. Multiple new members in one snapshot share
one notification. New arrivals receive their own Room joined info toast after
HTTP admission. Removed Live/Connected labels and promotional copy stay absent;
offline players still show Reconnecting when relevant.

The active lobby card slides down from above the viewport on mount over 550ms.
Room updates and tab changes reuse the card and do not replay the entrance.
Reduced-motion preferences disable the entrance; the badge remains stationary.

## Room audio

`AudioController` stays mounted across lobby and gameplay and provides a gear
menu with a volume slider and mute toggle. `useAudio` owns a single Web Audio
context, gain and decoded-buffer cache for each room visit; tracks specify URL,
loop and playback key. Stable keys prevent snapshot updates from restarting music.
Phase changes stop the old source and discard late starts; leaving closes the
context. Volume and mute survive phase changes without restarting playback.

The lobby loops `public/audio/songs/waiting.mp3`. `games/zinger-audio.ts` maps
normal/final answering to looping `songs/zinger/gameplay.mp3` and each normal/final
voting phase to one play of `songs/zinger/voting.mp3`. Round 1 and 2 scoreboards
play `songs/zinger/leaderboards.mp3` once each. Reveals, intros and game over
have no music. Browsers blocking autoplay retry on pointer/keyboard
interaction. Audio failures do not block play. Seamless sound requires clean
recording endpoints; silence within a track is preserved.
Keep songs under `public/audio/songs/`; the sibling `sound-effects/` folder ignores
local effects until they are explicitly selected for inclusion.

Sound effects use the shared Web Audio context with a separate gain channel.
`playSoundEffect` and the named `zingerEffects` catalog provide reusable one-shot
playback. Zinger selections and answer/vote submission clicks play `select.mp3`;
other effects are catalogued for future use. Settings include a Sound effects
slider saved under `partisocial.effects-volume`; the mute button covers both
channels. Failed downloads never block game intents.
