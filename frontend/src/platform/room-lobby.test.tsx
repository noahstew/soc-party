import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomLobby } from "./room-lobby";
import type { Lobby } from "@/lib/protocol";

const lobby: Lobby = {
  code: "ABCDEF",
  ownerId: "owner",
  youId: "owner",
  gameId: "zinger",
  packSlug: "og",
  maxPlayers: 8,
  canStart: false,
  expiresAt: "2026-11-08T01:00:00Z",
  players: [{ id: "owner", name: "Alex", connected: true }],
};
const token = "a".repeat(64);
class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor(public url: URL) {
    FakeSocket.instances.push(this);
  }
  open() {
    this.onopen?.();
  }
  update(payload: Lobby) {
    this.onmessage?.({
      data: JSON.stringify({ type: "lobby_state", payload }),
    });
  }
}
function response(payload: unknown, status = 201) {
  return new Response(JSON.stringify(payload), { status });
}
async function createRoom() {
  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Alex" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create a room" }));
  await screen.findByText("ABCDEF");
  await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
  const socket = FakeSocket.instances.at(-1)!;
  act(() => {
    socket.open();
    socket.update(lobby);
  });
  return socket;
}
beforeEach(() => {
  sessionStorage.clear();
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  sessionStorage.clear();
});

describe("room lobby", () => {
  it("creates a room, authenticates one socket, and renders live arrivals", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ token, lobby }));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    const socket = await createRoom();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/rooms",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Alex" }),
      }),
    );
    expect(FakeSocket.instances).toHaveLength(1);
    expect(socket.url.toString()).not.toContain(token);
    expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({
      type: "session_auth",
      payload: { token },
    });
    act(() =>
      socket.update({
        ...lobby,
        players: [
          ...lobby.players,
          { id: "guest", name: "Sam", connected: true },
        ],
      }),
    );
    expect(
      screen.getByRole("list", { name: "Players in room" }),
    ).toHaveTextContent("Sam");
    expect(screen.getByText("Players (2/8)")).toBeInTheDocument();
    expect(screen.getByLabelText("Share this room link")).toHaveValue(
      "http://localhost:3000/?room=ABCDEF",
    );
    const game = screen.getByRole("combobox", { name: "Game" });
    expect(game).toHaveValue("zinger");
    expect(game).toBeEnabled();
    expect(screen.getByRole("option", { name: "Coming soon" })).toBeDisabled();
    fireEvent.change(game, { target: { value: "zinger" } });
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "select_game",
      payload: { gameId: "zinger" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove Sam" }));
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "kick_player",
      payload: { playerId: "guest" },
    });
    fireEvent.change(screen.getByLabelText("Room size"), {
      target: { value: "4" },
    });
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "update_settings",
      payload: { maxPlayers: 4 },
    });
  });
  it("joins from a shared code and shows guest controls", async () => {
    window.history.replaceState(null, "", "/?room=ABCDEF");
    const guestLobby = {
      ...lobby,
      youId: "guest",
      players: [
        ...lobby.players,
        { id: "guest", name: "Sam", connected: false },
      ],
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(response({ token, lobby: guestLobby }));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await waitFor(() =>
      expect(screen.getByLabelText("Have a room code?")).toHaveValue("ABCDEF"),
    );
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Sam" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join a room" }));
    await screen.findByText("ABCDEF");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/rooms/ABCDEF/join",
      expect.anything(),
    );
    expect(screen.queryByLabelText("Room size")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Game" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Game" })).toHaveValue(
      "zinger",
    );
    expect(
      screen.queryByRole("button", { name: /Remove/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Players in room" }),
    ).toHaveTextContent("Sam");
  });
  it("validates input and displays admission failures", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(response({ error: "room not found or expired" }, 404));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    fireEvent.click(screen.getByRole("button", { name: "Create a room" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name");
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join a room" }));
    expect(screen.getByRole("alert")).toHaveTextContent("six-character");
    fireEvent.change(screen.getByLabelText("Have a room code?"), {
      target: { value: "ABCDEF" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join a room" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "room not found or expired",
      ),
    );
    expect(screen.getByRole("button", { name: "Create a room" })).toBeEnabled();
  });
  it("restores a saved guest using a rotated token", async () => {
    sessionStorage.setItem(
      "soc-party.guest",
      JSON.stringify({ code: "ABCDEF", token: "b".repeat(64) }),
    );
    const fetch = vi.fn().mockResolvedValue(response({ token, lobby }));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await screen.findByText("ABCDEF");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/rooms/ABCDEF/reconnect",
      expect.objectContaining({
        body: JSON.stringify({ token: "b".repeat(64) }),
      }),
    );
    expect(JSON.parse(sessionStorage.getItem("soc-party.guest")!).token).toBe(
      token,
    );
  });
  it("clears revoked sessions and allows joining again", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    const socket = await createRoom();
    act(() => socket.onclose?.({ code: 1008 }));
    expect(screen.getByRole("alert")).toHaveTextContent("room session ended");
    expect(
      screen.getByRole("button", { name: "Create a room" }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("soc-party.guest")).toBeNull();
  });
  it("leaves and closes the socket on cleanup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    const view = render(<RoomLobby apiURL="http://localhost:8080" />);
    const socket = await createRoom();
    fireEvent.click(screen.getByRole("button", { name: "Leave room" }));
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "leave_room",
      payload: {},
    });
    expect(socket.close).toHaveBeenCalled();
    expect(sessionStorage.getItem("soc-party.guest")).toBeNull();
    expect(
      within(view.container).getByLabelText("Your name"),
    ).toBeInTheDocument();
  });
  it("shows a useful error for offline and malformed responses", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(response({ token: "bad", lobby }));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create a room" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Network unavailable",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create a room" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("invalid room"),
    );
    expect(FakeSocket.instances).toHaveLength(0);
  });
});
