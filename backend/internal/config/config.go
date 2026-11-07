// Package config validates server configuration from the environment.
package config

import (
	"example.com/soc-party/backend/internal/database"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr        string
	DatabaseURL     string
	GameDatabaseURL string
	AllowedOrigins  []string
	ShutdownTimeout time.Duration
}

// Load receives environment lookup explicitly so tests never mutate process state.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{HTTPAddr: getenv("HTTP_ADDR"), DatabaseURL: getenv("DATABASE_URL"), ShutdownTimeout: 10 * time.Second}
	if cfg.HTTPAddr == "" {
		cfg.HTTPAddr = ":8080"
	}
	if _, port, err := net.SplitHostPort(cfg.HTTPAddr); err != nil || port == "" {
		return Config{}, fmt.Errorf("HTTP_ADDR must be host:port")
	}
	// ResolveTCPAddr also rejects nonnumeric/out-of-range ports without accepting a URL.
	if _, err := net.ResolveTCPAddr("tcp", cfg.HTTPAddr); err != nil {
		return Config{}, fmt.Errorf("invalid HTTP_ADDR: %w", err)
	}
	u, err := url.Parse(cfg.DatabaseURL)
	if err != nil || u == nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Hostname() == "" || u.Path == "" || u.Path == "/" {
		return Config{}, fmt.Errorf("DATABASE_URL must be a postgres URL with host and database")
	}
	cfg.GameDatabaseURL, err = database.GameURL(cfg.DatabaseURL)
	if err != nil {
		return Config{}, err
	}
	origins := getenv("ALLOWED_ORIGINS")
	if origins == "" {
		origins = "http://localhost:3000"
	}
	for _, origin := range strings.Split(origins, ",") {
		origin = strings.TrimSpace(origin)
		u, err := url.Parse(origin)
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
			return Config{}, fmt.Errorf("ALLOWED_ORIGINS must contain exact HTTP(S) origins")
		}
		cfg.AllowedOrigins = append(cfg.AllowedOrigins, origin)
	}
	if v := getenv("SHUTDOWN_TIMEOUT"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil || d <= 0 || d > time.Minute {
			return Config{}, fmt.Errorf("SHUTDOWN_TIMEOUT must be positive and at most 1m")
		}
		cfg.ShutdownTimeout = d
	}
	return cfg, nil
}
