package platform

import (
	"context"
	"errors"

	"example.com/soc-party/backend/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

type PostgresRepository struct {
	Pool interface {
		Begin(context.Context) (pgx.Tx, error)
	}
}

func (p PostgresRepository) Save(ctx context.Context, s Record, create bool) error {
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := store.New(tx)
	if create {
		err = q.InsertRoom(ctx, store.InsertRoomParams{ID: s.ID, Code: s.Code, OwnerID: s.OwnerID, ExpiresAt: pgtype.Timestamptz{Time: s.Expires, Valid: true}})
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.ConstraintName == "rooms_code_key" {
				return ErrConflict
			}
			return err
		}
	}
	existing, err := q.ListRoomPlayers(ctx, s.ID)
	if err != nil {
		return err
	}
	known := make(map[string]bool)
	for _, p := range existing {
		known[p.ID] = true
	}
	for _, p := range s.Members {
		if !known[p.ID] {
			if err = q.InsertPlayer(ctx, store.InsertPlayerParams{ID: p.ID, RoomID: s.ID, Name: p.Name, TokenHash: p.Hash[:]}); err != nil {
				return err
			}
		}
		if err = q.SavePlayer(ctx, store.SavePlayerParams{ID: p.ID, TokenHash: p.Hash[:], Connected: p.Connected, Status: p.Status, AvatarID: int32(p.AvatarID)}); err != nil {
			return err
		}
	}
	if err = q.SaveRoom(ctx, store.SaveRoomParams{SelectedPackSlugs: s.SelectedPackSlugs, GameID: s.GameID, ID: s.ID, OwnerID: s.OwnerID, MaxPlayers: int32(s.MaxPlayers), Status: s.Status, ExpiresAt: pgtype.Timestamptz{Time: s.Expires, Valid: true}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Reset closes audit records from a prior process; no live state is recovered.
func (p PostgresRepository) Reset(ctx context.Context) error {
	tx, err := p.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := store.New(tx)
	if err = q.CloseStaleRooms(ctx); err != nil {
		return err
	}
	if err = q.DisconnectStalePlayers(ctx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
