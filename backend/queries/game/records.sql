-- name: InsertGameSession :one
INSERT INTO game_sessions(id, room_id, pack_id) VALUES ($1, $2, $3) RETURNING *;

-- name: InsertGamePlayer :one
INSERT INTO game_players(session_id, player_id, display_name) VALUES ($1, $2, $3) RETURNING *;

-- name: InsertRound :one
INSERT INTO rounds(session_id, number, deadline) VALUES ($1, $2, $3) RETURNING *;

-- name: InsertMatchup :one
INSERT INTO matchups(session_id, round_id, prompt_id, prompt_text) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: AssignAnswer :one
INSERT INTO answers(session_id, matchup_id, player_id, slot) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: SubmitAnswer :one
UPDATE answers SET text = $4, submitted_at = now()
WHERE session_id = $1 AND matchup_id = $2 AND player_id = $3 AND text IS NULL RETURNING *;

-- name: InsertVote :exec
INSERT INTO votes(session_id, matchup_id, player_id, answer_id) VALUES ($1, $2, $3, $4);

-- name: SetPlayerScore :exec
UPDATE game_players SET score = $3 WHERE session_id = $1 AND player_id = $2;

-- name: FinishGame :exec
UPDATE game_sessions SET status = $2, finished_at = now() WHERE id = $1;
