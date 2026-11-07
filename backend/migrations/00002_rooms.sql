-- +goose Up
CREATE TABLE rooms (
    id text PRIMARY KEY CHECK (length(id) = 32),
    code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z2-9]{6}$'),
    owner_id text NOT NULL,
    game_id text NOT NULL DEFAULT 'wit_parade' CHECK (game_id = 'wit_parade'),
    pack_slug text NOT NULL DEFAULT 'og' CHECK (length(pack_slug) BETWEEN 1 AND 80),
    max_players integer NOT NULL DEFAULT 8 CHECK (max_players BETWEEN 3 AND 8),
    status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'closed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);
CREATE TABLE room_players (
    id text PRIMARY KEY CHECK (length(id) = 32),
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 24),
    token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
    connected boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left', 'kicked')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (room_id, id)
);
ALTER TABLE rooms ADD CONSTRAINT room_owner_membership
    FOREIGN KEY (id, owner_id) REFERENCES room_players(room_id, id)
    DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX room_active_names ON room_players (room_id, lower(name)) WHERE status = 'active';
CREATE INDEX room_expiry ON rooms (expires_at) WHERE status <> 'closed';
CREATE INDEX room_membership ON room_players (room_id, joined_at);

-- +goose Down
ALTER TABLE rooms DROP CONSTRAINT room_owner_membership;
DROP TABLE room_players;
DROP TABLE rooms;
