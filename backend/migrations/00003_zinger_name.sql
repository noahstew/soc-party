-- +goose Up
ALTER TABLE rooms DROP CONSTRAINT rooms_game_id_check;
UPDATE rooms SET game_id = 'zinger' WHERE game_id = 'wit_parade';
ALTER TABLE rooms ALTER COLUMN game_id SET DEFAULT 'zinger';
ALTER TABLE rooms ADD CONSTRAINT rooms_game_id_check CHECK (game_id = 'zinger');

-- +goose Down
ALTER TABLE rooms DROP CONSTRAINT rooms_game_id_check;
UPDATE rooms SET game_id = 'wit_parade' WHERE game_id = 'zinger';
ALTER TABLE rooms ALTER COLUMN game_id SET DEFAULT 'wit_parade';
ALTER TABLE rooms ADD CONSTRAINT rooms_game_id_check CHECK (game_id = 'wit_parade');
