import { ToastProvider } from "@/components/ui/toast";
import type { ReactNode } from "react";
import {
  act,
  fireEvent,
  render as rtlRender,
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
  games: [
    {
      id: "zinger",
      title: "Zinger",
      packs: [
        { slug: "og", title: "OG" },
        { slug: "extended", title: "Extended" },
      ],
    },
  ],
  selectedPackSlugs: ["og"],
  maxPlayers: 8,
  canStart: false,
  expiresAt: "2026-11-08T01:00:00Z",
  players: [{ id: "owner", name: "Alex", avatarId: 1, connected: true }],
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
  fireEvent.change(screen.getByLabelText("Player Name"), {
    target: { value: "Alex" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Create Room" }));
  await screen.findByLabelText("Room code ABCDEF");
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
  localStorage.clear();
  FakeSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("room lobby", () => {
  it("copies the room URL beside the code and shows a success toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await createRoom();

    fireEvent.click(screen.getByRole("button", { name: "Copy URL" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Room link copied!"),
    );
    expect(writeText).toHaveBeenCalledWith(
      "http://localhost:3000/lobby?room=ABCDEF",
    );
    expect(
      screen.getByRole("status").closest('[data-slot="toast"]'),
    ).toHaveAttribute("data-event", "success");
  });

  it.each(["rejected", "unavailable"])(
    "shows an error toast when the clipboard is %s",
    async (clipboardState) => {
      vi.stubGlobal("navigator", {
        clipboard:
          clipboardState === "rejected"
            ? { writeText: vi.fn().mockRejectedValue(new Error("Denied")) }
            : undefined,
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(response({ token, lobby })),
      );
      render(<RoomLobby apiURL="http://localhost:8080" />);
      await createRoom();

      fireEvent.click(screen.getByRole("button", { name: "Copy URL" }));

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Unable to copy the room link. Please try again.",
        ),
      );
      expect(screen.queryByText("Room link copied!")).not.toBeInTheDocument();
    },
  );

  it("keeps only essential lobby content and one placeholder per settings tab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await createRoom();
    const room = screen.getByRole("region", { name: "Room lobby" });
    expect(
      within(room).queryByText(
        /Live|Connected|The waiting room|Your player|^You$|Make room|gameplay|Invite your|Everyone joins|The rest of/,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy URL" }).querySelector("svg"),
    ).not.toBeNull();
    const footer = screen.getByRole("button", { name: "Leave room" })
      .parentElement!.parentElement!;
    expect(footer.textContent).toBe("Leave roomStart game");
    expect(footer).toHaveClass("justify-end");
    fireEvent.click(screen.getByRole("tab", { name: "Room" }));
    expect(
      within(screen.getByRole("tabpanel", { name: "Room" })).queryByText(
        "ABCDEF",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coming Soon" })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "Game" }));
    expect(screen.getByRole("button", { name: "Coming Soon" })).toBeDisabled();
  });

  it.each(["owner", "guest"])(
    "notifies the %s about arrivals without repeating on updates or reconnect",
    async (youId) => {
      const initial = {
        ...lobby,
        youId,
        players: [
          ...lobby.players,
          { id: "guest", name: "Sam", avatarId: 1, connected: true },
        ],
      };
      sessionStorage.setItem(
        "soc-party.guest",
        JSON.stringify({ code: lobby.code, token }),
      );
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(response({ token, lobby: initial })),
      );
      render(<RoomLobby apiURL="http://localhost:8080" />);
      await screen.findByLabelText("Room code ABCDEF");
      await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
      const socket = FakeSocket.instances.at(-1)!;
      act(() => {
        socket.open();
        socket.update(initial);
      });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      const joined = {
        ...initial,
        players: [
          ...initial.players,
          { id: "new", name: "Charlie", avatarId: 1, connected: false },
        ],
      };
      act(() => socket.update(joined));
      expect(screen.getByRole("status")).toHaveTextContent(
        "Charlie joined the room.",
      );
      expect(
        screen.getByRole("status").closest('[data-slot="toast"]'),
      ).toHaveAttribute("data-event", "info");
      fireEvent.click(
        screen.getByRole("button", { name: "Dismiss notification" }),
      );
      await waitFor(() =>
        expect(screen.queryByRole("status")).not.toBeInTheDocument(),
      );
      const connected = {
        ...joined,
        players: joined.players.map((player) => ({
          ...player,
          connected: true,
        })),
      };
      act(() => {
        socket.update(connected);
        socket.update(connected);
      });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      act(() => socket.onerror?.());
      fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
      const retrySocket = FakeSocket.instances.at(-1)!;
      act(() => {
        retrySocket.open();
        retrySocket.update(connected);
      });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );

  it("includes every arrival when a room update contains several new players", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    const socket = await createRoom();
    act(() =>
      socket.update({
        ...lobby,
        players: [
          ...lobby.players,
          { id: "sam", name: "Sam", avatarId: 1, connected: true },
          { id: "jo", name: "Jo", avatarId: 1, connected: true },
        ],
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sam, Jo joined the room.",
    );
  });

  it("opens Lobby first and navigates settings with the keyboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    const socket = await createRoom();
    expect(screen.getByRole("tab", { name: "Lobby" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "Lobby" })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Lobby" }), {
      key: "End",
    });
    expect(screen.getByRole("tab", { name: "Game" })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Game" })).toBeVisible();
    const pack = screen.getByRole("button", { name: "OG pack" });
    expect(pack).toHaveAttribute("aria-pressed", "true");
    expect(pack).toBeEnabled();
    expect(screen.getByRole("img", { name: "Pack selected" })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Game" }), {
      key: "Home",
    });
    expect(screen.getByRole("tab", { name: "Lobby" })).toHaveFocus();
    expect(socket.send).toHaveBeenCalledTimes(1);
  });

  it("toggles packs through authoritative updates and clears eligibility when none are selected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    const socket = await createRoom();
    fireEvent.click(screen.getByRole("tab", { name: "Game" }));
    const pack = screen.getByRole("button", { name: "OG pack" });
    expect(screen.getByRole("img", { name: "Pack selected" })).toBeVisible();
    fireEvent.click(pack);
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "select_pack",
      payload: { gameId: "zinger", packSlug: "og", selected: false },
    });
    expect(pack).toHaveAttribute("aria-pressed", "true");
    act(() =>
      socket.update({ ...lobby, selectedPackSlugs: [], canStart: false }),
    );
    expect(pack).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("img", { name: "Pack selected" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Select at least one pack to start."),
    ).toBeVisible();
    fireEvent.click(pack);
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "select_pack",
      payload: { gameId: "zinger", packSlug: "og", selected: true },
    });
    act(() => socket.update({ ...lobby, selectedPackSlugs: ["og"] }));
    expect(screen.getByRole("img", { name: "Pack selected" })).toBeVisible();
    expect(
      screen.queryByText("Select at least one pack to start."),
    ).not.toBeInTheDocument();
    act(() => socket.onerror?.());
    expect(pack).toBeDisabled();
  });

  it("lets guests see selected packs while reserving toggles for the owner", async () => {
    sessionStorage.setItem(
      "soc-party.guest",
      JSON.stringify({ code: lobby.code, token }),
    );
    const guestLobby = {
      ...lobby,
      youId: "guest",
      players: [
        ...lobby.players,
        { id: "guest", name: "Sam", avatarId: 1, connected: true },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby: guestLobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await screen.findByLabelText("Room code ABCDEF");
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    const socket = FakeSocket.instances.at(-1)!;
    act(() => {
      socket.open();
      socket.update(guestLobby);
    });
    fireEvent.click(screen.getByRole("tab", { name: "Game" }));
    expect(screen.getByRole("button", { name: "OG pack" })).toBeDisabled();
    expect(screen.getByRole("img", { name: "Pack selected" })).toBeVisible();
    act(() => socket.update({ ...guestLobby, selectedPackSlugs: [] }));
    expect(
      screen.queryByRole("img", { name: "Pack selected" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Select at least one pack to start."),
    ).toBeVisible();
    expect(socket.send).toHaveBeenCalledTimes(1);
  });

  it("loads Extended from the catalog and supports multiple checked packs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    const socket = await createRoom();
    fireEvent.click(screen.getByRole("tab", { name: "Game" }));
    const extended = screen.getByRole("button", { name: "Extended pack" });
    expect(extended).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(extended);
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "select_pack",
      payload: { gameId: "zinger", packSlug: "extended", selected: true },
    });
    act(() =>
      socket.update({ ...lobby, selectedPackSlugs: ["og", "extended"] }),
    );
    expect(screen.getAllByRole("img", { name: "Pack selected" })).toHaveLength(
      2,
    );
    act(() => socket.update({ ...lobby, selectedPackSlugs: ["extended"] }));
    expect(screen.getByRole("button", { name: "OG pack" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(extended).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByText("Select at least one pack to start."),
    ).not.toBeInTheDocument();
  });

  it("renders large catalogs without truncating choices and includes one disabled Coming Soon tile in each grid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    const socket = await createRoom();
    const games = Array.from({ length: 60 }, (_, i) => ({
      id: `game_${i}`,
      title: `Game ${i}`,
      packs: Array.from({ length: 90 }, (_, j) => ({
        slug: `pack_${j}`,
        title: `Pack ${j}`,
      })),
    }));
    const many = { ...lobby, gameId: "game_0", games, selectedPackSlugs: [] };
    act(() => socket.update(many));
    fireEvent.click(screen.getByRole("tab", { name: "Room" }));
    const gameScroller = screen.getByRole("region", {
      name: "Available games",
    });
    expect(within(gameScroller).getAllByRole("button")).toHaveLength(61);
    const soon = screen.getByRole("button", { name: "Coming Soon" });
    expect(soon).toBeDisabled();
    expect(gameScroller).toContainElement(soon);
    fireEvent.click(screen.getByRole("button", { name: "Game 59" }));
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "select_game",
      payload: { gameId: "game_59" },
    });
    act(() => socket.update({ ...many, gameId: "game_59" }));
    fireEvent.click(screen.getByRole("tab", { name: "Game" }));
    const packScroller = screen.getByRole("region", {
      name: "Available packs",
    });
    expect(within(packScroller).getAllByRole("button")).toHaveLength(91);
    expect(packScroller).toContainElement(
      screen.getByRole("button", { name: "Coming Soon" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Pack 89 pack" }));
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "select_pack",
      payload: { gameId: "game_59", packSlug: "pack_89", selected: true },
    });
  });

  it("keeps players alongside desktop settings and adapts when resized", async () => {
    let matches = true;
    let resize: () => void = () => {};
    vi.stubGlobal("matchMedia", () => ({
      matches,
      addEventListener: (_event: string, callback: () => void) => {
        resize = callback;
      },
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await createRoom();
    expect(
      screen.queryByRole("tab", { name: "Lobby" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Lobby" })).toBeVisible();
    expect(screen.getByRole("tabpanel", { name: "Room" })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Game" }));
    expect(screen.getByRole("region", { name: "Lobby" })).toBeVisible();
    expect(screen.getByRole("tabpanel", { name: "Game" })).toBeVisible();
    act(() => {
      matches = false;
      resize();
    });
    expect(screen.getByRole("tab", { name: "Game" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Lobby" }));
    expect(screen.getByRole("tabpanel", { name: "Lobby" })).toBeVisible();
    expect(
      screen.queryByRole("tabpanel", { name: "Game" }),
    ).not.toBeInTheDocument();
  });

  it("disables owner controls on disconnect and reconnects without losing the room", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    const socket = await createRoom();
    act(() => socket.onerror?.());
    fireEvent.click(screen.getByRole("tab", { name: "Room" }));
    expect(screen.getByLabelText("Room size")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Zinger/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    await waitFor(() => expect(FakeSocket.instances).toHaveLength(2));
    expect(socket.close).toHaveBeenCalled();
    expect(sessionStorage.getItem("soc-party.guest")).not.toBeNull();
  });

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
    expect(window.location.pathname).toBe("/lobby");
    expect(window.location.search).toBe("?room=ABCDEF");
    expect(localStorage.getItem("soc-party.name")).toBe("Alex");
    expect(screen.getByRole("status")).toHaveTextContent("Room created!");
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
          { id: "guest", name: "Sam", avatarId: 1, connected: true },
        ],
      }),
    );
    expect(
      screen.getByRole("list", { name: "Players in room" }),
    ).toHaveTextContent("Sam");
    expect(screen.getByLabelText("Players (2/8)")).toBeInTheDocument();
    expect(screen.getByLabelText("2 people connected")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Room owner" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Room" }));
    const game = screen.getByRole("button", { name: /Zinger/ });
    expect(game).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Game selected")).not.toBeInTheDocument();
    expect(game).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Coming Soon" })).toHaveLength(
      1,
    );
    for (const button of screen.getAllByRole("button", {
      name: "Coming Soon",
    })) {
      expect(button).toBeDisabled();
    }
    fireEvent.click(game);
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "select_game",
      payload: { gameId: "zinger" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Room size" }));
    const fourPlayers = await screen.findByRole("option", {
      name: "4 players",
    });
    fireEvent.pointerDown(fourPlayers, { pointerType: "mouse", button: 0 });
    fireEvent.click(fourPlayers);
    await waitFor(() =>
      expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
        type: "update_settings",
        payload: { maxPlayers: 4 },
      }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Lobby" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Sam" }));
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "kick_player",
      payload: { playerId: "guest" },
    });
  });
  it("disables room sizes below current membership", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ token, lobby })),
    );
    render(<RoomLobby apiURL="http://localhost:8080" />);
    const socket = await createRoom();
    act(() =>
      socket.update({
        ...lobby,
        players: [
          ...lobby.players,
          ...[1, 2, 3].map((id) => ({
            id: String(id),
            name: `Guest ${id}`,
            avatarId: 1,
            connected: true,
          })),
        ],
      }),
    );
    fireEvent.click(screen.getByRole("tab", { name: "Room" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Room size" }));
    expect(
      await screen.findByRole("option", { name: "3 players" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("option", { name: "4 players" }),
    ).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("combobox", { name: "Room size" })).toHaveFocus();
  });

  it("joins from a shared code and shows guest controls", async () => {
    window.history.replaceState(null, "", "/?room=ABCDEF");
    const guestLobby = {
      ...lobby,
      youId: "guest",
      players: [
        ...lobby.players,
        { id: "guest", name: "Sam", avatarId: 1, connected: false },
      ],
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(response({ token, lobby: guestLobby }));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await waitFor(() =>
      expect(screen.getByLabelText("Room Code")).toHaveValue("ABCDEF"),
    );
    fireEvent.change(screen.getByLabelText("Player Name"), {
      target: { value: "Sam" },
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/lobby");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByLabelText("Room code ABCDEF");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/rooms/ABCDEF/join",
      expect.anything(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Room joined!");
    expect(
      screen.getByRole("status").closest('[data-slot="toast"]'),
    ).toHaveAttribute("data-event", "info");
    fireEvent.click(screen.getByRole("tab", { name: "Room" }));
    expect(screen.getByLabelText("Room size")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Zinger/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "Lobby" }));
    expect(screen.getByRole("img", { name: "Room owner" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Remove/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Players in room" }),
    ).toHaveTextContent("Alex");
    expect(screen.getByText("Sam")).toBeInTheDocument();
  });
  it("automatically joins a lobby URL with a remembered name", async () => {
    window.history.replaceState(null, "", "/lobby?room=abcdef");
    localStorage.setItem("soc-party.name", "Alex");
    const fetch = vi.fn().mockResolvedValue(response({ token, lobby }));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await screen.findByLabelText("Room code ABCDEF");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/rooms/ABCDEF/join",
      expect.objectContaining({ body: JSON.stringify({ name: "Alex" }) }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Room joined!");
    expect(
      screen.getByRole("status").closest('[data-slot="toast"]'),
    ).toHaveAttribute("data-event", "info");
    expect(window.location.pathname + window.location.search).toBe(
      "/lobby?room=ABCDEF",
    );
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("honors a shared room instead of reconnecting to a different saved room", async () => {
    window.history.replaceState(null, "", "/?room=ABCDEF");
    localStorage.setItem("soc-party.name", "Alex");
    sessionStorage.setItem(
      "soc-party.guest",
      JSON.stringify({ code: "BCDEFG", token }),
    );
    const fetch = vi.fn().mockResolvedValue(response({ token, lobby }));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await screen.findByLabelText("Room code ABCDEF");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/rooms/ABCDEF/join",
      expect.anything(),
    );
  });

  it("recovers an existing identity when the shared link matches the saved room", async () => {
    window.history.replaceState(null, "", "/lobby?room=ABCDEF");
    sessionStorage.setItem(
      "soc-party.guest",
      JSON.stringify({ code: "ABCDEF", token }),
    );
    const fetch = vi.fn().mockResolvedValue(response({ token, lobby }));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await screen.findByLabelText("Room code ABCDEF");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/rooms/ABCDEF/reconnect",
      expect.anything(),
    );
  });

  it("returns to editable admission after a shared room cannot be joined", async () => {
    window.history.replaceState(null, "", "/lobby?room=ABCDEF");
    localStorage.setItem("soc-party.name", "Alex");
    const fetch = vi
      .fn()
      .mockResolvedValue(response({ error: "room not found or expired" }, 404));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "room not found or expired",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Create Room" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Room Code" })).toHaveValue(
      "ABCDEF",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed shared codes without sending a join request", async () => {
    window.history.replaceState(null, "", "/lobby?room=invalid");
    localStorage.setItem("soc-party.name", "Alex");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("six-character"),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("validates input and displays admission failures", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(response({ error: "room not found or expired" }, 404));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name");
    const notifications = screen.getByRole("region", { name: "Notifications" });
    expect(notifications).toContainElement(screen.getByRole("alert"));
    expect(
      screen.getByRole("region", { name: "Room admission" }),
    ).not.toContainElement(screen.getByRole("alert"));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Player Name"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(screen.getByRole("alert")).toHaveTextContent("six-character");
    fireEvent.change(screen.getByLabelText("Room Code"), {
      target: { value: "ABCDEF" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "room not found or expired",
      ),
    );
    expect(screen.getByRole("button", { name: "Create Room" })).toBeEnabled();
  });
  it("restores a saved guest using a rotated token", async () => {
    sessionStorage.setItem(
      "soc-party.guest",
      JSON.stringify({ code: "ABCDEF", token: "b".repeat(64) }),
    );
    const fetch = vi.fn().mockResolvedValue(response({ token, lobby }));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    await screen.findByLabelText("Room code ABCDEF");
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
      screen.getByRole("button", { name: "Continue" }),
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
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
    expect(sessionStorage.getItem("soc-party.guest")).toBeNull();
    expect(
      within(view.container).getByLabelText("Player Name"),
    ).toBeInTheDocument();
  });
  it("shows a useful error for offline and malformed responses", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(response({ token: "bad", lobby }));
    vi.stubGlobal("fetch", fetch);
    render(<RoomLobby apiURL="http://localhost:8080" />);
    fireEvent.change(screen.getByLabelText("Player Name"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Room" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Network unavailable",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create Room" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("invalid room"),
    );
    expect(FakeSocket.instances).toHaveLength(0);
  });
});

function render(ui: ReactNode) {
  return rtlRender(<ToastProvider>{ui}</ToastProvider>);
}

it("cycles only your avatar and renders server changes for everyone", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ token, lobby })));
  render(<RoomLobby apiURL="http://localhost:8080" />);
  const socket = await createRoom();
  expect(screen.getByRole("img", { name: "Alex avatar" })).toHaveAttribute(
    "src",
    expect.stringContaining("1.png"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Previous avatar" }));
  expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toMatchObject({
    type: "select_avatar",
    payload: { avatarId: 8 },
  });
  act(() =>
    socket.update({
      ...lobby,
      players: [
        { ...lobby.players[0], avatarId: 8 },
        { id: "guest", name: "Sam", avatarId: 3, connected: true },
      ],
    }),
  );
  expect(screen.getByRole("img", { name: "Alex avatar" })).toHaveAttribute(
    "src",
    expect.stringContaining("8.png"),
  );
  expect(screen.getByRole("img", { name: "Sam avatar" })).toHaveAttribute(
    "src",
    expect.stringContaining("3.png"),
  );
  expect(screen.getAllByRole("button", { name: "Next avatar" })).toHaveLength(
    1,
  );
  fireEvent.click(screen.getByRole("button", { name: "Next avatar" }));
  expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toMatchObject({
    type: "select_avatar",
    payload: { avatarId: 1 },
  });
  act(() => socket.onclose?.({ code: 1006 }));
  expect(screen.getByRole("button", { name: "Next avatar" })).toBeDisabled();
});
