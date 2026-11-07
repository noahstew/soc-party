-- name: ListOfficialPacks :many
SELECT id, slug, title FROM prompt_packs
WHERE is_official = true AND status = 'published'
ORDER BY id;

-- name: CreatePack :one
INSERT INTO prompt_packs (slug, title, is_official, status)
VALUES ($1, $2, $3, $4)
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title, is_official = EXCLUDED.is_official,
    status = EXCLUDED.status, updated_at = now()
RETURNING id;

-- name: CreatePrompt :one
INSERT INTO prompts (pack_id, position, text, status)
VALUES ($1, $2, $3, $4)
ON CONFLICT (pack_id, position) DO UPDATE
SET text = EXCLUDED.text, status = EXCLUDED.status, updated_at = now()
RETURNING id;

-- name: CountPacks :one
SELECT count(*) FROM prompt_packs;

-- name: CountPrompts :one
SELECT count(*) FROM prompts WHERE pack_id = $1;

-- name: ListApprovedPrompts :many
SELECT p.id, p.pack_id, p.position, p.text FROM prompts p
JOIN prompt_packs pack ON pack.id = p.pack_id
WHERE pack.slug = $1 AND pack.is_official AND pack.status = 'published' AND p.status = 'approved'
ORDER BY p.position;
