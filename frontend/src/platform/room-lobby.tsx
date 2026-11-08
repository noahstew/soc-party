"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  isLobby,
  type ClientMessage,
  type Lobby,
  type Session,
} from "@/lib/protocol";

const storageKey = "soc-party.guest";
type Credential = { code: string; token: string };
type Connection = "connecting" | "connected" | "disconnected";

function remember(credential: Credential | null) {
  try {
    if (credential)
      sessionStorage.setItem(storageKey, JSON.stringify(credential));
    else sessionStorage.removeItem(storageKey);
  } catch {
    // Play remains available when browser storage is disabled.
  }
}

async function intent(
  apiURL: string,
  path: string,
  body: object,
): Promise<Session> {
  const response = await fetch(`${apiURL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Unable to join. Please try again.";
    throw new Error(message);
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !("token" in data) ||
    typeof data.token !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.token) ||
    !("lobby" in data) ||
    !isLobby(data.lobby)
  ) {
    throw new Error("The server returned an invalid room. Please try again.");
  }
  return { token: data.token, lobby: data.lobby };
}

export function RoomLobby({ apiURL }: { apiURL: string }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [credential, setCredential] = useState<Credential | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<Connection>("connecting");
  const [retry, setRetry] = useState(0);
  const [shareURL, setShareURL] = useState("");
  const socket = useRef<WebSocket | null>(null);
  const restored = useRef(false);

  function accept(session: Session) {
    const next = { code: session.lobby.code, token: session.token };
    remember(next);
    setLobby(session.lobby);
    setCredential(next);
    setConnection("connecting");
  }

  useEffect(() => {
    let cancelled = false;
    // A deferred read avoids using browser globals during server rendering.
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      const sharedCode = new URL(window.location.href).searchParams.get("room");
      if (sharedCode && /^[A-Z2-9]{6}$/i.test(sharedCode))
        setCode(sharedCode.toUpperCase());
      if (restored.current) return;
      restored.current = true;
      let saved: unknown;
      try {
        saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      } catch {
        return;
      }
      if (
        typeof saved !== "object" ||
        saved === null ||
        !("code" in saved) ||
        typeof saved.code !== "string" ||
        !/^[A-Z2-9]{6}$/.test(saved.code) ||
        !("token" in saved) ||
        typeof saved.token !== "string"
      )
        return;
      setBusy(true);
      try {
        const session = await intent(
          apiURL,
          `/api/rooms/${saved.code}/reconnect`,
          { token: saved.token },
        );
        // Persist a rotated token even if the component unmounted while HTTP completed.
        remember({ code: session.lobby.code, token: session.token });
        if (!cancelled) accept(session);
      } catch {
        remember(null);
        if (!cancelled)
          setError(
            "Your previous room has expired. Create or join a room below.",
          );
      } finally {
        if (!cancelled) setBusy(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiURL]);

  useEffect(() => {
    if (!credential) return;
    let stopped = false;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let current: WebSocket | null = null;
    const connect = () => {
      if (stopped) return;
      const url = new URL(`/api/rooms/${credential.code}/ws`, apiURL);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(url);
      current = ws;
      socket.current = ws;
      ws.onopen = () => {
        if (stopped) {
          ws.close();
          return;
        }
        ws.send(
          JSON.stringify({
            type: "session_auth",
            payload: { token: credential.token },
          } satisfies ClientMessage),
        );
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN)
            ws.send(
              JSON.stringify({
                type: "ping",
                payload: {},
              } satisfies ClientMessage),
            );
        }, 20000);
      };
      ws.onmessage = (event: MessageEvent<string>) => {
        if (stopped) return;
        try {
          const message: unknown = JSON.parse(event.data);
          if (
            typeof message !== "object" ||
            message === null ||
            !("type" in message) ||
            !("payload" in message)
          )
            throw new Error("invalid message");
          if (message.type === "lobby_state" && isLobby(message.payload)) {
            if (message.payload.code !== credential.code)
              throw new Error("wrong room");
            retries = 0;
            setLobby(message.payload);
            setConnection("connected");
            const share = new URL(window.location.origin);
            share.searchParams.set("room", credential.code);
            setShareURL(share.toString());
          } else if (
            message.type === "error" &&
            typeof message.payload === "object" &&
            message.payload !== null &&
            "message" in message.payload &&
            typeof message.payload.message === "string"
          ) {
            setError(message.payload.message);
          } else throw new Error("invalid message");
        } catch {
          setError("A room update could not be read. Please reconnect.");
          ws.close();
        }
      };
      ws.onclose = (event: CloseEvent) => {
        if (heartbeat) clearInterval(heartbeat);
        if (stopped) return;
        setConnection("disconnected");
        if (event.code === 1008) {
          remember(null);
          setCredential(null);
          setLobby(null);
          setError(
            "Your room session ended. You can create or join a room again.",
          );
        } else if (retries < 3) {
          retries += 1;
          timer = setTimeout(connect, 1000 * retries);
        } else {
          setError(
            "Connection lost. Try reconnecting, or return home to join again.",
          );
        }
      };
      ws.onerror = () => {
        if (!stopped) setConnection("disconnected");
      };
    };
    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (heartbeat) clearInterval(heartbeat);
      if (socket.current === current) socket.current = null;
      current?.close();
    };
  }, [apiURL, credential, retry]);

  async function enter(action: "create" | "join") {
    if (busy) return;
    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanName || Array.from(cleanName).length > 24) {
      setError("Enter a name with 1–24 characters.");
      return;
    }
    if (action === "join" && !/^[A-Z2-9]{6}$/.test(cleanCode)) {
      setError("Enter the six-character room code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      accept(
        await intent(
          apiURL,
          action === "create" ? "/api/rooms" : `/api/rooms/${cleanCode}/join`,
          { name: cleanName },
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reach the server. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function send(message: ClientMessage) {
    if (
      socket.current?.readyState !== WebSocket.OPEN ||
      connection !== "connected"
    ) {
      setError("Wait for the room to reconnect.");
      return;
    }
    setError("");
    socket.current.send(JSON.stringify(message));
  }
  function leave() {
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(
        JSON.stringify({
          type: "leave_room",
          payload: {},
        } satisfies ClientMessage),
      );
    remember(null);
    setCredential(null);
    setLobby(null);
    setError("");
  }
  const owner = lobby?.youId === lobby?.ownerId;
  const inputStyle =
    "mt-2 w-full rounded-base border-2 border-border bg-secondary-background px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <section aria-labelledby="room-title">
      <Card className="bg-secondary-background">
        <CardHeader>
          <h2 id="room-title" className="text-2xl font-heading">
            {lobby ? "The waiting room" : "Get the group together"}
          </h2>
          <p>
            {lobby
              ? "Everyone joins on their own device."
              : "Pick a name. Start a room or hop into a friend’s."}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {lobby ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm">Room code</p>
                  <p
                    className="font-mono text-4xl font-bold tracking-widest"
                    aria-label={`Room code ${lobby.code}`}
                  >
                    {lobby.code}
                  </p>
                </div>
                <Badge variant="neutral">
                  {connection === "connected"
                    ? "Live"
                    : connection === "connecting"
                      ? "Connecting…"
                      : "Reconnecting…"}
                </Badge>
              </div>
              {shareURL && (
                <div>
                  <label htmlFor="share-link" className="text-sm">
                    Share this room link
                  </label>
                  <input
                    id="share-link"
                    readOnly
                    value={shareURL}
                    onFocus={(e) => e.target.select()}
                    className={inputStyle}
                  />
                </div>
              )}
              <div aria-live="polite" aria-atomic="true">
                <h3 className="mb-3 font-heading">
                  Players ({lobby.players.length}/{lobby.maxPlayers})
                </h3>
                <ul className="space-y-3" aria-label="Players in room">
                  {lobby.players.map((player) => (
                    <li
                      key={player.id}
                      className="flex items-center justify-between gap-3 rounded-base border-2 border-border p-3"
                    >
                      <div>
                        <span className="font-heading">{player.name}</span>
                        {player.id === lobby.youId && <span> (you)</span>}
                        {player.id === lobby.ownerId && (
                          <span className="ml-2 text-sm">Owner</span>
                        )}
                        <p className="text-sm">
                          {player.connected
                            ? "Connected"
                            : "Joining or reconnecting…"}
                        </p>
                      </div>
                      {owner && player.id !== lobby.youId && (
                        <Button
                          variant="neutral"
                          size="sm"
                          disabled={connection !== "connected"}
                          onClick={() =>
                            send({
                              type: "kick_player",
                              payload: { playerId: player.id },
                            })
                          }
                          aria-label={`Remove ${player.name}`}
                        >
                          Remove
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label htmlFor="room-game" className="font-heading">
                  Game
                </label>
                <select
                  id="room-game"
                  value={lobby.gameId}
                  disabled={!owner || connection !== "connected"}
                  onChange={(e) =>
                    send({
                      type: "select_game",
                      payload: { gameId: e.target.value },
                    })
                  }
                  className={inputStyle}
                  aria-describedby="game-description"
                >
                  <option value="zinger">Zinger</option>
                  <option value="coming_soon" disabled>
                    Coming soon
                  </option>
                </select>
                <p id="game-description" className="mt-2 text-sm">
                  {owner
                    ? "Choose a game for your group."
                    : "The room owner chooses the game."}{" "}
                  More games are on the way.
                </p>
              </div>
              {owner && (
                <div>
                  <label htmlFor="max-players" className="font-heading">
                    Room size
                  </label>
                  <select
                    id="max-players"
                    value={lobby.maxPlayers}
                    disabled={connection !== "connected"}
                    onChange={(e) =>
                      send({
                        type: "update_settings",
                        payload: { maxPlayers: Number(e.target.value) },
                      })
                    }
                    className={inputStyle}
                  >
                    {[3, 4, 5, 6, 7, 8].map((n) => (
                      <option
                        key={n}
                        value={n}
                        disabled={n < lobby.players.length}
                      >
                        {n} players
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-sm">
                {lobby.canStart
                  ? "The group is ready."
                  : "Gather at least 3 connected players."}{" "}
                Zinger gameplay is coming next.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="neutral" onClick={leave}>
                  {connection === "connected" ? "Leave room" : "Return home"}
                </Button>
                {connection === "disconnected" && (
                  <Button
                    onClick={() => {
                      setError("");
                      setRetry((v) => v + 1);
                    }}
                  >
                    Reconnect
                  </Button>
                )}
              </div>
            </>
          ) : (
            <form
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                void enter("join");
              }}
              className="space-y-5"
              aria-busy={busy}
            >
              <div>
                <label htmlFor="player-name" className="font-heading">
                  Your name
                </label>
                <input
                  id="player-name"
                  autoComplete="nickname"
                  maxLength={24}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  className={inputStyle}
                  placeholder="What should we call you?"
                />
              </div>
              <Button
                type="button"
                onClick={() => void enter("create")}
                disabled={busy}
                className="w-full"
              >
                {busy ? "One moment…" : "Create a room"}
              </Button>
              <div className="border-t-2 border-border pt-5">
                <label htmlFor="room-code" className="font-heading">
                  Have a room code?
                </label>
                <input
                  id="room-code"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  disabled={busy}
                  className={`${inputStyle} font-mono uppercase tracking-widest`}
                  placeholder="ABCDEF"
                />
              </div>
              <Button
                type="submit"
                variant="neutral"
                disabled={busy}
                className="w-full"
              >
                Join a room
              </Button>
              <p className="text-sm">
                No account needed. Up to 8 friends, one room.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
