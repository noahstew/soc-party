// Mirror backend/internal/protocol. Envelope names use snake_case; payloads use camelCase.
export type Player = { id: string; name: string; connected: boolean };
export type Lobby = {
  code: string;
  ownerId: string;
  youId: string;
  gameId: "zinger";
  packSlug: string;
  maxPlayers: number;
  canStart: boolean;
  expiresAt: string;
  players: Player[];
};
export type Session = { token: string; lobby: Lobby };
export type ClientMessage =
  | { type: "select_game"; id?: string; payload: { gameId: string } }
  | { type: "session_auth"; id?: string; payload: { token: string } }
  | { type: "ping" | "leave_room"; id?: string; payload: Record<string, never> }
  | { type: "kick_player"; id?: string; payload: { playerId: string } }
  | { type: "update_settings"; id?: string; payload: { maxPlayers: number } };
export type ServerMessage =
  | { type: "lobby_state"; id?: string; payload: Lobby }
  | { type: "error"; id?: string; payload: { message: string } };

export function isLobby(value: unknown): value is Lobby {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Partial<Lobby>;
  return (
    typeof p.code === "string" &&
    /^[A-Z2-9]{6}$/.test(p.code) &&
    typeof p.ownerId === "string" &&
    typeof p.youId === "string" &&
    p.gameId === "zinger" &&
    typeof p.packSlug === "string" &&
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
