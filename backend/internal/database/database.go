// Package database provisions and migrates the platform and game databases.
package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// GameURL uses the same PostgreSQL instance and credentials, with a distinct database.
func GameURL(platformURL string) (string, error) {
	u, err := url.Parse(platformURL)
	if err != nil || u == nil || u.Host == "" || (u.Scheme != "postgres" && u.Scheme != "postgresql") {
		return "", fmt.Errorf("invalid database URL")
	}
	u.Path = "/wit_parade"
	u.RawPath = ""
	return u.String(), nil
}

// Migrate needs CREATEDB on first startup only. Application queries remain in queries/.
func Migrate(ctx context.Context, platformURL, platformDir, gameDir string) error {
	gameURL, err := GameURL(platformURL)
	if err != nil {
		return err
	}
	conn, err := pgx.Connect(ctx, platformURL)
	if err != nil {
		return err
	}
	// Fixed identifier; CREATE DATABASE cannot run inside a goose transaction.
	_, err = conn.Exec(ctx, "CREATE DATABASE wit_parade")
	_ = conn.Close(ctx)
	if err != nil {
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "42P04" {
			return err
		}
	}
	for _, item := range []struct{ url, dir string }{{platformURL, platformDir}, {gameURL, gameDir}} {
		db, err := sql.Open("pgx", item.url)
		if err != nil {
			return err
		}
		provider, err := goose.NewProvider(goose.DialectPostgres, db, os.DirFS(item.dir))
		if err == nil {
			_, err = provider.Up(ctx)
		}
		_ = db.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

// Apply runs bounded startup migrations.
func Apply(platformURL string) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	return Migrate(ctx, platformURL, "migrations", "game_migrations")
}
