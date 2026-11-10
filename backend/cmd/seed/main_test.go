package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReadPack(t *testing.T) {
	tests := []struct {
		name, content string
		wantErr       bool
	}{
		{"valid", `{"slug":"test","title":"Original","prompts":["An original question."]}`, false},
		{"empty title", `{"slug":"test","title":" ","prompts":["A question"]}`, true},
		{"empty prompts", `{"slug":"test","title":"Test","prompts":[]}`, true},
		{"empty prompt", `{"slug":"test","title":"Test","prompts":[" "]}`, true},
		{"long prompt", `{"slug":"test","title":"Test","prompts":["` + strings.Repeat("x", 501) + `"]}`, true},
		{"unknown field", `{"slug":"test","title":"Test","prompts":["Hi"],"other":true}`, true},
		{"trailing value", `{"slug":"test","title":"Test","prompts":["Hi"]} {}`, true},
		{"invalid json", `{`, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "pack.json")
			if err := os.WriteFile(path, []byte(tt.content), 0600); err != nil {
				t.Fatal(err)
			}
			_, err := readPack(path)
			if (err != nil) != tt.wantErr {
				t.Fatalf("readPack error = %v; wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestOfficialPack(t *testing.T) {
	p, err := readPack("../../data/og_pack.json")
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Prompts) < 2*8+1 {
		t.Fatalf("starter pack has %d prompts", len(p.Prompts))
	}
	seen := map[string]bool{}
	for _, text := range p.Prompts {
		if seen[strings.ToLower(strings.Join(strings.Fields(text), " "))] {
			t.Fatalf("duplicate prompt: %s", text)
		}
		seen[strings.ToLower(strings.Join(strings.Fields(text), " "))] = true
	}
}

func TestOGPack(t *testing.T) {
	p, err := readPack("../../data/og_pack.json")
	if err != nil {
		t.Fatal(err)
	}
	if p.Slug != "og" || p.Title != "OG" || len(p.Prompts) != 29 {
		t.Fatalf("invalid OG metadata: %+v", p)
	}
	seen := map[string]bool{}
	for _, prompt := range p.Prompts {
		if seen[strings.ToLower(strings.Join(strings.Fields(prompt), " "))] {
			t.Fatalf("duplicate OG prompt: %s", prompt)
		}
		seen[strings.ToLower(strings.Join(strings.Fields(prompt), " "))] = true
	}
}

func TestExtendedPack(t *testing.T) {
	extended, err := readPack("../../data/extended_pack.json")
	if err != nil {
		t.Fatal(err)
	}
	if extended.Slug != "extended" || extended.Title != "Extended" || len(extended.Prompts) != 3 {
		t.Fatalf("invalid Extended metadata: %+v", extended)
	}
	seen := map[string]bool{}
	for _, path := range []string{"../../data/og_pack.json"} {
		original, err := readPack(path)
		if err != nil {
			t.Fatal(err)
		}
		for _, text := range original.Prompts {
			seen[strings.ToLower(strings.Join(strings.Fields(text), " "))] = true
		}
	}
	for _, text := range extended.Prompts {
		if seen[strings.ToLower(strings.Join(strings.Fields(text), " "))] {
			t.Fatalf("duplicate Extended prompt: %s", text)
		}
		seen[strings.ToLower(strings.Join(strings.Fields(text), " "))] = true
	}
}
