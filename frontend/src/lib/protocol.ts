// Mirror backend/internal/protocol. Envelope names use snake_case; payloads use camelCase.
export type Player = { id: string; name: string; connected: boolean };
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
export type ClientMessage =
  | { type: "select_game"; id?: string; payload: { gameId: string } }
  | {
      type: "select_pack";
      id?: string;
      payload: { gameId: string; packSlug: string; selected: boolean };
    }
  | { type: "session_auth"; id?: string; payload: { token: string } }
  | { type: "ping" | "leave_room"; id?: string; payload: Record<string, never> }
  | { type: "kick_player"; id?: string; payload: { playerId: string } }
  | { type: "update_settings"; id?: string; payload: { maxPlayers: number } };
export type ServerMessage =
  | { type: "lobby_state"; id?: string; payload: Lobby }
  | { type: "error"; id?: string; payload: { message: string } };

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
        typeof v.connected === "boolean"
      );
    })
  );
}
