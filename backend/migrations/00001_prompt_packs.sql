-- +goose Up
CREATE TABLE prompt_packs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug text NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 80),
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
    is_official boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE prompts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pack_id bigint NOT NULL REFERENCES prompt_packs(id) ON DELETE CASCADE,
    position integer NOT NULL CHECK (position >= 0),
    text text NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (pack_id, position)
);

-- +goose Down
DROP TABLE prompts;
DROP TABLE prompt_packs;
