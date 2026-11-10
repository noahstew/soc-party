-- +goose Up
ALTER TABLE rooms ADD COLUMN selected_pack_slugs text[] NOT NULL DEFAULT ARRAY['og']::text[];
UPDATE rooms SET selected_pack_slugs = CASE WHEN pack_selected THEN ARRAY[pack_slug] ELSE ARRAY[]::text[] END;
ALTER TABLE rooms DROP COLUMN pack_selected, DROP COLUMN pack_slug;
ALTER TABLE rooms ADD CONSTRAINT rooms_pack_selection_check CHECK (
    array_position(selected_pack_slugs, NULL) IS NULL AND
    COALESCE(array_ndims(selected_pack_slugs), 1) = 1
);
ALTER TABLE rooms DROP CONSTRAINT rooms_game_id_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_game_id_check CHECK (game_id ~ '^[a-z][a-z0-9_-]{0,79}$');

-- +goose Down
ALTER TABLE rooms ADD COLUMN pack_slug text NOT NULL DEFAULT 'og' CHECK (length(pack_slug) BETWEEN 1 AND 80);
ALTER TABLE rooms ADD COLUMN pack_selected boolean NOT NULL DEFAULT true;
UPDATE rooms SET pack_slug = COALESCE(selected_pack_slugs[1], 'og'), pack_selected = cardinality(selected_pack_slugs) > 0;
ALTER TABLE rooms DROP COLUMN selected_pack_slugs;
ALTER TABLE rooms DROP CONSTRAINT rooms_game_id_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_game_id_check CHECK (game_id = 'zinger');
