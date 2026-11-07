-- +goose Up
-- room_id/player_id reference platform records by application-validated opaque ID.
CREATE TABLE game_sessions (
    id text PRIMARY KEY CHECK (length(id) = 32),
    room_id text NOT NULL CHECK (length(room_id) = 32),
    pack_id bigint NOT NULL REFERENCES prompt_packs(id),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'finished', 'abandoned')),
    created_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    CHECK ((status IN ('finished', 'abandoned')) = (finished_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_live_game_per_room ON game_sessions(room_id) WHERE status IN ('pending', 'active');
CREATE TABLE game_players (
    session_id text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id text NOT NULL CHECK (length(player_id) = 32),
    display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 24),
    score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
    PRIMARY KEY (session_id, player_id)
);
CREATE TABLE rounds (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    number integer NOT NULL CHECK (number BETWEEN 1 AND 3),
    phase text NOT NULL DEFAULT 'answering' CHECK (phase IN ('answering', 'voting', 'results')),
    deadline timestamptz NOT NULL,
    UNIQUE (session_id, number), UNIQUE (session_id, id)
);
CREATE TABLE matchups (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id text NOT NULL,
    round_id bigint NOT NULL,
    prompt_id bigint NOT NULL REFERENCES prompts(id),
    prompt_text text NOT NULL CHECK (length(prompt_text) BETWEEN 1 AND 500),
    FOREIGN KEY (session_id, round_id) REFERENCES rounds(session_id, id) ON DELETE CASCADE,
    UNIQUE (round_id, prompt_id), UNIQUE (session_id, id)
);
CREATE TABLE answers (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id text NOT NULL,
    matchup_id bigint NOT NULL,
    player_id text NOT NULL,
    slot integer NOT NULL CHECK (slot IN (1, 2)),
    text text CHECK (length(trim(text)) BETWEEN 1 AND 280),
    submitted_at timestamptz,
    points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
    FOREIGN KEY (session_id, matchup_id) REFERENCES matchups(session_id, id) ON DELETE CASCADE,
    FOREIGN KEY (session_id, player_id) REFERENCES game_players(session_id, player_id),
    UNIQUE (matchup_id, slot), UNIQUE (matchup_id, player_id), UNIQUE (session_id, matchup_id, id),
    CHECK ((text IS NULL) = (submitted_at IS NULL))
);
CREATE TABLE votes (
    session_id text NOT NULL,
    matchup_id bigint NOT NULL,
    player_id text NOT NULL,
    answer_id bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (matchup_id, player_id),
    FOREIGN KEY (session_id, player_id) REFERENCES game_players(session_id, player_id),
    FOREIGN KEY (session_id, matchup_id, answer_id) REFERENCES answers(session_id, matchup_id, id) ON DELETE CASCADE
);
CREATE INDEX game_room_history ON game_sessions(room_id, created_at);
-- Phase transitions, voter eligibility and score calculation belong to the M2 engine.

-- +goose Down
DROP TABLE votes;
DROP TABLE answers;
DROP TABLE matchups;
DROP TABLE rounds;
DROP TABLE game_players;
DROP TABLE game_sessions;
