-- name: InsertRoom :exec
INSERT INTO rooms(id, code, owner_id, expires_at) VALUES ($1, $2, $3, $4);

-- name: InsertPlayer :exec
INSERT INTO room_players(id, room_id, name, token_hash) VALUES ($1, $2, $3, $4);

-- name: SavePlayer :exec
UPDATE room_players SET token_hash = $2, connected = $3, status = $4, avatar_id = $5, last_seen_at = now()
WHERE id = $1;

-- name: SaveRoom :exec
UPDATE rooms SET owner_id = $2, max_players = $3, expires_at = $4, status = $5, game_id = $6, selected_pack_slugs = $7 WHERE id = $1;

-- name: CloseStaleRooms :exec
UPDATE rooms SET status = 'closed' WHERE status <> 'closed';

-- name: DisconnectStalePlayers :exec
UPDATE room_players SET connected = false WHERE connected;

-- name: GetRoom :one
SELECT * FROM rooms WHERE code = $1;

-- name: ListRoomPlayers :many
SELECT * FROM room_players WHERE room_id = $1 ORDER BY joined_at, id;
