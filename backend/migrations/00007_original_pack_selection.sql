-- +goose Up
ALTER TABLE rooms ALTER COLUMN selected_pack_slugs SET DEFAULT ARRAY['original']::text[];
UPDATE rooms SET selected_pack_slugs = ARRAY(
    SELECT DISTINCT CASE WHEN slug IN ('og', 'extended') THEN 'original' ELSE slug END
    FROM unnest(selected_pack_slugs) AS slug
    ORDER BY 1
) WHERE game_id = 'zinger' AND selected_pack_slugs && ARRAY['og', 'extended']::text[];

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN
    RAISE EXCEPTION 'Original pack selection consolidation requires a backup to reverse';
END $$;
-- +goose StatementEnd
