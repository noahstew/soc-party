-- +goose Up
ALTER TABLE rooms ADD COLUMN pack_selected boolean NOT NULL DEFAULT true;

-- +goose Down
ALTER TABLE rooms DROP COLUMN pack_selected;
