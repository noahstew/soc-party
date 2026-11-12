# WebSocket protocol

The backend package `internal/protocol` is authoritative and
`frontend/src/lib/protocol.ts` mirrors it. Messages use a strict JSON envelope:

```json
{"type":"snake_case","id":"optional-correlation-id","payload":{}}
```

Unknown envelope or payload fields, malformed JSON, payload/type mismatches and
messages over 4096 bytes are rejected. IDs are opaque and at most 128 bytes.
Payload field names use camelCase. Clients send intents; the server owns phases,
deadlines, scores and authorized per-player projections.

## Client messages

| Type | Payload | Rules |
| --- | --- | --- |
| `session_auth` | `{token}` | First socket message, within five seconds. |
| `ping`, `leave_room` | `{}` | Existing room lifecycle. |
| `kick_player` | `{playerId}` | Owner only. |
| `update_settings` | `{maxPlayers}` | Owner/lobby only. |
| `select_game` | `{gameId}` | Owner/lobby only. |
| `select_pack` | `{gameId, packSlug, selected}` | Owner/lobby only. |
| `start_game` | `{}` | Connected owner, eligible lobby only. |
| `update_draft` | `{promptId, text}` | Assigned prompt, answering phase; rate limited by room runtime. |
| `submit_answer` | `{promptId, text}` | Assigned prompt, answering phase; locks the answer. |
| `update_vote` | `{matchupId, answerId}` | Replace the eligible non-author’s private selection; does not finish voting. |
| `cast_vote` | `{matchupId, answerId}` | Submit and lock an eligible non-author’s vote during the active matchup. |
| `submit_final_votes` | `{answerIds}` | Three opaque IDs, with repetitions allowed to stack votes; submits and locks the ballot. Zero picks only for players with no eligible answers. |
| `return_to_lobby` | `{}` | Owner only, game-over only. |

## Server messages

`lobby_state` carries the existing per-player lobby projection. `game_state` carries
the per-player game projection: `phase`, `round`, `multiplierPermille`, `deadlineMs`,
`serverNowMs`, scores/presence/finished state and only the phase-specific prompts,
answers, voting controls or reveal data that player may see. During voting, answers
contain no author or vote metadata. `selectedAnswerIds` restores only the recipient’s
selection (including repetitions in finals); `voteSubmitted` identifies a locked ballot.
Other players' drafts never appear.

`error` carries `{code, message}` and echoes a supplied envelope `id`. Stable gameplay
codes include `not_enough_prompts`, `wrong_phase`, `invalid_answer`,
`unassigned_prompt`, `answer_locked`, `not_eligible_to_vote`, `invalid_vote`,
`vote_locked`, `cannot_pick_own_answer`, `too_many_picks`, `forbidden`,
`rate_limited` and `unavailable`. The message is suitable for player feedback; clients
branch on the code rather than matching prose.
