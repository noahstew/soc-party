import { describe, expect, it } from "vitest";
import { isGameState, isLobby } from "./protocol";

const valid = {
  code: "ABCDEF",
  ownerId: "owner",
  youId: "owner",
  gameId: "future_game",
  games: [
    {
      id: "future_game",
      title: "Future Game",
      packs: [
        { slug: "first", title: "First" },
        { slug: "second", title: "Second" },
      ],
    },
  ],
  selectedPackSlugs: ["first", "second"],
  maxPlayers: 8,
  canStart: false,
  expiresAt: "2026-11-09T12:00:00Z",
  players: [{ id: "owner", name: "Alex", connected: true }],
};

describe("catalog lobby protocol", () => {
  it("accepts registered games and multiple or empty selections", () => {
    expect(isLobby(valid)).toBe(true);
    expect(isLobby({ ...valid, selectedPackSlugs: [] })).toBe(true);
  });
  it.each([
    { games: null },
    { games: [{ ...valid.games[0], packs: null }] },
    { games: [valid.games[0], valid.games[0]] },
    {
      games: [
        {
          ...valid.games[0],
          packs: [valid.games[0].packs[0], valid.games[0].packs[0]],
        },
      ],
    },
    { games: [{ ...valid.games[0], title: " " }] },
    { games: [{ ...valid.games[0], id: "../invalid" }] },
    { selectedPackSlugs: ["unknown"] },
    { selectedPackSlugs: ["first", "first"] },
    { selectedPackSlugs: [42] },
    { selectedPackSlugs: null },
  ])("rejects malformed or inconsistent catalog state: %j", (change) => {
    expect(isLobby({ ...valid, ...change })).toBe(false);
  });
});

describe("game state protocol", () => {
  const state = {
    phase: "answering",
    round: 1,
    multiplierPermille: 1000,
    deadlineMs: 1000,
    serverNowMs: 500,
    players: [
      {
        id: "p1",
        name: "Alex",
        connected: true,
        left: false,
        score: 0,
        roundDelta: 0,
        finished: false,
      },
    ],
    prompts: [{ id: "prompt", text: "Prompt", draft: "", submitted: false }],
  };

  it("accepts a valid player projection", () =>
    expect(isGameState(state)).toBe(true));
  it.each([
    { phase: "secret_phase" },
    { round: 4 },
    { serverNowMs: "500" },
    { players: [{ ...state.players[0], score: "zero" }] },
    { prompts: [{ id: "prompt", text: "Prompt" }] },
  ])("rejects malformed game state: %j", (change) => {
    expect(isGameState({ ...state, ...change })).toBe(false);
  });
});
