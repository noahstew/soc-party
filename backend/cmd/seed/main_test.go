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

func TestOriginalPack(t *testing.T) {
	p, err := readPack("../../data/original_pack.json")
	if err != nil {
		t.Fatal(err)
	}
	if p.Slug != "original" || p.Title != "Original" || len(p.Prompts) != 32 {
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

func TestNSFWPack(t *testing.T) {
	p, err := readPack("../../data/nsfw_pack.json")
	if err != nil {
		t.Fatal(err)
	}
	if p.Slug != "nsfw" || p.Title != "NSFW" || len(p.Prompts) != 50 {
		t.Fatalf("invalid NSFW pack metadata or count: %+v", p)
	}
	// Either pack must support a full eight-player game by itself.
	if len(p.Prompts) < 2*8+1 {
		t.Fatal("NSFW pack cannot supply a full game")
	}
	original, err := readPack("../../data/original_pack.json")
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, text := range append(original.Prompts, p.Prompts...) {
		key := strings.ToLower(strings.Join(strings.Fields(text), " "))
		if seen[key] {
			t.Fatalf("duplicate prompt across official packs: %s", text)
		}
		seen[key] = true
	}
}
