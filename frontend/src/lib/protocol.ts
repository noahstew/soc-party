// Mirror backend/internal/protocol. Envelope names use snake_case; payloads use camelCase.
export type Player = {
  id: string;
  name: string;
  avatarId: number;
  connected: boolean;
};
export type PackChoice = { slug: string; title: string };
export type GameChoice = { id: string; title: string; packs: PackChoice[] };
export type Lobby = {
  code: string;
  ownerId: string;
  youId: string;
  gameId: string;
  games: GameChoice[];
  selectedPackSlugs: string[];
  maxPlayers: number;
  canStart: boolean;
  expiresAt: string;
  players: Player[];
};
export type Session = { token: string; lobby: Lobby };
export type GamePhase =
  | "round_intro"
  | "answering"
  | "matchup_voting"
  | "matchup_reveal"
  | "round_scoreboard"
  | "final_intro"
  | "final_answering"
  | "final_voting"
  | "final_reveal"
  | "game_over";
export type GamePlayer = Omit<Player, "avatarId"> & {
  left: boolean;
  score: number;
  roundDelta: number;
  finished: boolean;
};
export type GameAnswer = {
  id: string;
  text: string;
  authorId?: string;
  author?: string;
  votes?: number;
  points?: number;
  bonus?: number;
};
export type GamePrompt = {
  id: string;
  text: string;
  draft?: string;
  submitted: boolean;
};
export type GameState = {
  votingOpensAtMs?: number;
  phase: GamePhase;
  round: number;
  multiplierPermille: number;
  deadlineMs?: number;
  serverNowMs: number;
  players: GamePlayer[];
  prompts?: GamePrompt[];
  prompt?: GamePrompt;
  matchupId?: string;
  answers?: GameAnswer[];
  canVote?: boolean;
  voteSubmitted?: boolean;
  maxPicks?: number;
  selectedAnswerIds?: string[];
};
export type ClientMessage =
  | { type: "select_avatar"; id?: string; payload: { avatarId: number } }
  | { type: "select_game"; id?: string; payload: { gameId: string } }
  | {
      type: "select_pack";
      id?: string;
      payload: { gameId: string; packSlug: string; selected: boolean };
    }
  | { type: "session_auth"; id?: string; payload: { token: string } }
  | { type: "ping" | "leave_room"; id?: string; payload: Record<string, never> }
  | { type: "kick_player"; id?: string; payload: { playerId: string } }
  | { type: "update_settings"; id?: string; payload: { maxPlayers: number } }
  | {
      type: "start_game" | "return_to_lobby";
      id?: string;
      payload: Record<string, never>;
    }
  | {
      type: "update_draft" | "submit_answer";
      id?: string;
      payload: { promptId: string; text: string };
    }
  | {
      type: "cast_vote" | "update_vote";
      id?: string;
      payload: { matchupId: string; answerId: string };
    }
  | {
      type: "submit_final_votes";
      id?: string;
      payload: { answerIds: string[] };
    };
export type ServerMessage =
  | { type: "lobby_state"; id?: string; payload: Lobby }
  | { type: "game_state"; id?: string; payload: GameState }
  | { type: "error"; id?: string; payload: { code: string; message: string } };

const catalogID = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z][a-z0-9_-]{0,79}$/.test(value);
const title = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  Array.from(value).length <= 120;

function isGame(value: unknown): value is GameChoice {
  if (typeof value !== "object" || value === null) return false;
  const game = value as Partial<GameChoice>;
  return (
    catalogID(game.id) &&
    title(game.title) &&
    Array.isArray(game.packs) &&
    game.packs.every((value: unknown) => {
      if (typeof value !== "object" || value === null) return false;
      const pack = value as Partial<PackChoice>;
      return catalogID(pack.slug) && title(pack.title);
    }) &&
    new Set(game.packs.map((pack) => pack.slug)).size === game.packs.length
  );
}

export function isLobby(value: unknown): value is Lobby {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Partial<Lobby>;
  return (
    typeof p.code === "string" &&
    /^[A-Z2-9]{6}$/.test(p.code) &&
    typeof p.ownerId === "string" &&
    typeof p.youId === "string" &&
    catalogID(p.gameId) &&
    Array.isArray(p.games) &&
    p.games.every(isGame) &&
    new Set(p.games.map((game) => game.id)).size === p.games.length &&
    Array.isArray(p.selectedPackSlugs) &&
    p.selectedPackSlugs.every(catalogID) &&
    new Set(p.selectedPackSlugs).size === p.selectedPackSlugs.length &&
    p.selectedPackSlugs.every((slug) =>
      p.games
        ?.find((game) => game.id === p.gameId)
        ?.packs.some((pack) => pack.slug === slug),
    ) &&
    typeof p.maxPlayers === "number" &&
    p.maxPlayers >= 3 &&
    p.maxPlayers <= 8 &&
    typeof p.canStart === "boolean" &&
    typeof p.expiresAt === "string" &&
    Array.isArray(p.players) &&
    p.players.length <= 8 &&
    p.players.every((player: unknown) => {
      if (typeof player !== "object" || player === null) return false;
      const v = player as Partial<Player>;
      return (
        typeof v.id === "string" &&
        typeof v.name === "string" &&
        typeof v.avatarId === "number" &&
        Number.isInteger(v.avatarId) &&
        v.avatarId >= 1 &&
        v.avatarId <= 8 &&
        typeof v.connected === "boolean"
      );
    })
  );
}

const gamePhases = new Set<GamePhase>([
  "round_intro",
  "answering",
  "matchup_voting",
  "matchup_reveal",
  "round_scoreboard",
  "final_intro",
  "final_answering",
  "final_voting",
  "final_reveal",
  "game_over",
]);

export function isGameState(value: unknown): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<GameState>;
  return (
    typeof state.phase === "string" &&
    gamePhases.has(state.phase as GamePhase) &&
    typeof state.round === "number" &&
    state.round >= 1 &&
    state.round <= 3 &&
    typeof state.multiplierPermille === "number" &&
    typeof state.serverNowMs === "number" &&
    (state.votingOpensAtMs === undefined ||
      (typeof state.votingOpensAtMs === "number" &&
        Number.isFinite(state.votingOpensAtMs))) &&
    (state.deadlineMs === undefined || typeof state.deadlineMs === "number") &&
    Array.isArray(state.players) &&
    state.players.every(
      (player) =>
        typeof player.id === "string" &&
        typeof player.name === "string" &&
        typeof player.connected === "boolean" &&
        typeof player.left === "boolean" &&
        typeof player.score === "number" &&
        typeof player.roundDelta === "number" &&
        typeof player.finished === "boolean",
    ) &&
    (state.answers === undefined ||
      (Array.isArray(state.answers) &&
        state.answers.every(
          (answer) =>
            typeof answer.id === "string" && typeof answer.text === "string",
        ))) &&
    (state.prompts === undefined ||
      (Array.isArray(state.prompts) &&
        state.prompts.every(
          (prompt) =>
            typeof prompt.id === "string" &&
            typeof prompt.text === "string" &&
            typeof prompt.submitted === "boolean",
        )))
  );
}
