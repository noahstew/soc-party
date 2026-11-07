package config

import (
	"testing"
	"time"
)

func TestLoad(t *testing.T) {
	tests := []struct {
		name, addr, url, timeout string
		wantErr                  bool
	}{
		{"defaults", "", "postgres://party:party@db:5432/party", "", false},
		{"explicit", "127.0.0.1:9000", "postgresql://user@localhost/game", "5s", false},
		{"missing database", "", "", "", true},
		{"bad scheme", "", "https://db/party", "", true},
		{"missing database name", "", "postgres://db/", "", true},
		{"missing host", "", "postgres:///party", "", true},
		{"bad address", "not-an-address", "postgres://db/party", "", true},
		{"invalid port", ":99999", "postgres://db/party", "", true},
		{"zero timeout", "", "postgres://db/party", "0s", true},
		{"negative timeout", "", "postgres://db/party", "-1s", true},
		{"invalid timeout", "", "postgres://db/party", "tomorrow", true},
		{"unbounded timeout", "", "postgres://db/party", "2m", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := map[string]string{"HTTP_ADDR": tt.addr, "DATABASE_URL": tt.url, "SHUTDOWN_TIMEOUT": tt.timeout}
			cfg, err := Load(func(k string) string { return env[k] })
			if (err != nil) != tt.wantErr {
				t.Fatalf("Load error=%v; wantErr=%v", err, tt.wantErr)
			}
			if err == nil {
				if cfg.DatabaseURL != tt.url {
					t.Fatal("database URL changed")
				}
				if tt.addr == "" && cfg.HTTPAddr != ":8080" {
					t.Fatal("wrong default address")
				}
				if tt.timeout == "" && cfg.ShutdownTimeout != 10*time.Second {
					t.Fatal("wrong default timeout")
				}
				if tt.timeout == "5s" && cfg.ShutdownTimeout != 5*time.Second {
					t.Fatal("wrong explicit timeout")
				}
			}
		})
	}
}
