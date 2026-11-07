// Package config validates server configuration from the environment.
package config

import (
	"fmt"
	"net"
	"net/url"
	"time"
)

type Config struct {
	HTTPAddr        string
	DatabaseURL     string
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
	if v := getenv("SHUTDOWN_TIMEOUT"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil || d <= 0 || d > time.Minute {
			return Config{}, fmt.Errorf("SHUTDOWN_TIMEOUT must be positive and at most 1m")
		}
		cfg.ShutdownTimeout = d
	}
	return cfg, nil
}
