-- +goose Up
ALTER TABLE room_players ADD COLUMN avatar_id integer NOT NULL DEFAULT 1 CHECK (avatar_id BETWEEN 1 AND 8);

-- +goose Down
ALTER TABLE room_players DROP COLUMN avatar_id;
