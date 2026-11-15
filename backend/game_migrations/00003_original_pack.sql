-- +goose Up
-- Keep the OG identity where possible so historical references survive.
UPDATE prompt_packs SET slug = 'original', title = 'Original', updated_at = now()
WHERE slug = 'og' AND NOT EXISTS (SELECT 1 FROM prompt_packs WHERE slug = 'original');

INSERT INTO prompt_packs (slug, title, is_official, status)
VALUES ('original', 'Original', true, 'published')
ON CONFLICT (slug) DO UPDATE SET title = 'Original', is_official = true, status = 'published';

-- Append every legacy question, including content added beyond the seed.
WITH moved AS (
    SELECT p.id, row_number() OVER (ORDER BY CASE pack.slug WHEN 'og' THEN 0 ELSE 1 END, p.position, p.id) AS ordinal
    FROM prompts p JOIN prompt_packs pack ON pack.id = p.pack_id
    WHERE pack.slug IN ('og', 'extended')
), target AS (
    SELECT id, COALESCE((SELECT max(position) + 1 FROM prompts WHERE pack_id = pack.id), 0) AS offset_position
    FROM prompt_packs pack WHERE slug = 'original'
)
UPDATE prompts p SET pack_id = target.id,
    position = (target.offset_position + moved.ordinal - 1)::integer, updated_at = now()
FROM moved, target WHERE p.id = moved.id;

UPDATE game_sessions SET pack_id = (SELECT id FROM prompt_packs WHERE slug = 'original')
WHERE pack_id IN (SELECT id FROM prompt_packs WHERE slug IN ('og', 'extended'));
DELETE FROM prompt_packs WHERE slug IN ('og', 'extended');

-- +goose Down
-- Content consolidation cannot be reversed without guessing original ownership.
-- +goose StatementBegin
DO $$ BEGIN
    RAISE EXCEPTION 'Original pack consolidation requires a backup to reverse';
END $$;
-- +goose StatementEnd
