// Command migrate provisions the game database and applies both goose migration sets.
package main

import (
	"example.com/soc-party/backend/internal/database"
	"log/slog"
	"os"
)

func main() {
	if err := database.Apply(os.Getenv("DATABASE_URL")); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}
}
