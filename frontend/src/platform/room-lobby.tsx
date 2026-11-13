"use client";

import { useEffect, useRef, useState } from "react";
import { RoomEntry } from "./room-entry";
import { useToast } from "@/lib/use-toast";
import { LobbyView } from "./lobby-view";
import { AudioController } from "@/components/audio-controller";
import { zingerAudio } from "@/games/zinger-audio";
import {
  isGameState,
  isLobby,
  type ClientMessage,
  type GameState,
  type Lobby,
  type Session,
} from "@/lib/protocol";
import { ZingerGame } from "@/games/zinger-game";

const storageKey = "soc-party.guest";
const nameStorageKey = "soc-party.name";
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
  const [sharedCode, setSharedCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [credential, setCredential] = useState<Credential | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const { notify, dismiss } = useToast();
  const [connection, setConnection] = useState<Connection>("connecting");
  const [retry, setRetry] = useState(0);
  const [shareURL, setShareURL] = useState("");
  const socket = useRef<WebSocket | null>(null);
  const restored = useRef(false);
  const previousPlayers = useRef(new Set<string>());

  function accept(session: Session) {
    const next = { code: session.lobby.code, token: session.token };
    remember(next);
    const playerName = session.lobby.players.find(
      (player) => player.id === session.lobby.youId,
    )?.name;
    if (playerName) {
      setName(playerName);
      try {
        localStorage.setItem(nameStorageKey, playerName);
      } catch {
        // Shared links still work with an explicit name when storage is disabled.
      }
    }
    window.history.replaceState(null, "", `/lobby?room=${next.code}`);
    previousPlayers.current = new Set(
      session.lobby.players.map((player) => player.id),
    );
    setLobby(session.lobby);
    setCredential(next);
    setConnection("connecting");
  }

  useEffect(() => {
    let cancelled = false;
    // A deferred read avoids using browser globals during server rendering.
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      if (restored.current) return;
      restored.current = true;
      const urlCode = new URL(window.location.href).searchParams.get("room");
      const targetCode =
        urlCode && /^[A-Z2-9]{6}$/i.test(urlCode)
          ? urlCode.toUpperCase()
          : null;
      if (targetCode) {
        setCode(targetCode);
        setSharedCode(targetCode);
        window.history.replaceState(null, "", `/lobby?room=${targetCode}`);
      } else if (urlCode) {
        notify("Enter the six-character room code.", "error");
      }
      let saved: unknown = null;
      let savedName = "";
      try {
        savedName = localStorage.getItem(nameStorageKey)?.trim() ?? "";
      } catch {
        // Names can be entered manually when storage is disabled.
      }
      if (!savedName || Array.from(savedName).length > 24) savedName = "";
      if (savedName) setName((current) => current || savedName);
      try {
        saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      } catch {
        // A corrupt or unavailable session must not block shared links.
      }
      const credential =
        typeof saved === "object" &&
        saved !== null &&
        "code" in saved &&
        typeof saved.code === "string" &&
        /^[A-Z2-9]{6}$/.test(saved.code) &&
        "token" in saved &&
        typeof saved.token === "string"
          ? { code: saved.code, token: saved.token }
          : null;
      const recover =
        credential && (!targetCode || targetCode === credential.code);
      if (!recover && !(targetCode && savedName)) return;
      setBusy(true);
      try {
        const session = recover
          ? await intent(apiURL, `/api/rooms/${credential.code}/reconnect`, {
              token: credential.token,
            })
          : await intent(apiURL, `/api/rooms/${targetCode}/join`, {
              name: savedName,
            });
        // Persist a rotated token even if the component unmounted while HTTP completed.
        remember({ code: session.lobby.code, token: session.token });
        if (!cancelled) {
          accept(session);
          if (!recover) notify("Room joined!", "info");
        }
      } catch (err) {
        if (recover) remember(null);
        if (!cancelled) {
          setSharedCode(null);
          notify(
            recover
              ? "Your previous room has expired. Create or join a room below."
              : err instanceof Error
                ? err.message
                : "Unable to reach the server. Try again.",
            "error",
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiURL, notify]);

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
            const arrivals = message.payload.players.filter(
              (player) => !previousPlayers.current.has(player.id),
            );
            previousPlayers.current = new Set(
              message.payload.players.map((player) => player.id),
            );
            if (arrivals.length > 0) {
              notify(
                `${arrivals.map((player) => player.name).join(", ")} joined the room.`,
                "info",
              );
            }
            retries = 0;
            setLobby(message.payload);
            setGame(null);
            setConnection("connected");
            const share = new URL("/lobby", window.location.origin);
            share.searchParams.set("room", credential.code);
            setShareURL(share.toString());
          } else if (
            message.type === "game_state" &&
            isGameState(message.payload)
          ) {
            setGame(message.payload);
            setConnection("connected");
          } else if (
            message.type === "error" &&
            typeof message.payload === "object" &&
            message.payload !== null &&
            "message" in message.payload &&
            typeof message.payload.message === "string"
          ) {
            notify(message.payload.message, "error");
          } else throw new Error("invalid message");
        } catch {
          notify("A room update could not be read. Please reconnect.", "error");
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
          setSharedCode(null);
          window.history.replaceState(null, "", "/");
          notify(
            "Your room session ended. You can create or join a room again.",
            "error",
          );
        } else if (retries < 3) {
          retries += 1;
          timer = setTimeout(connect, 1000 * retries);
        } else {
          notify(
            "Connection lost. Try reconnecting, or return home to join again.",
            "error",
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
  }, [apiURL, credential, retry, notify]);

  async function enter(action: "create" | "join") {
    if (busy) return;
    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanName || Array.from(cleanName).length > 24) {
      notify("Enter a name with 1–24 characters.", "error");
      return;
    }
    if (action === "join" && !/^[A-Z2-9]{6}$/.test(cleanCode)) {
      notify("Enter the six-character room code.", "error");
      return;
    }
    setBusy(true);
    dismiss();
    try {
      accept(
        await intent(
          apiURL,
          action === "create" ? "/api/rooms" : `/api/rooms/${cleanCode}/join`,
          { name: cleanName },
        ),
      );
      notify(
        action === "create"
          ? "Room created! Invite your friends."
          : "Room joined!",
        action === "create" ? "success" : "info",
      );
    } catch (err) {
      setSharedCode(null);
      notify(
        err instanceof Error
          ? err.message
          : "Unable to reach the server. Try again.",
        "error",
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
      notify("Wait for the room to reconnect.", "error");
      return;
    }
    dismiss();
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
    setSharedCode(null);
    setCode("");
    window.history.replaceState(null, "", "/");
    dismiss();
  }
  async function copyRoomLink() {
    try {
      await navigator.clipboard.writeText(shareURL);
      notify("Room link copied!", "success");
    } catch {
      notify("Unable to copy the room link. Please try again.", "error");
    }
  }
  if (!lobby) {
    return (
      <RoomEntry
        name={name}
        code={code}
        busy={busy}
        onNameChange={setName}
        onCodeChange={setCode}
        onContinue={sharedCode ? () => void enter("join") : undefined}
        onEnter={(action) => void enter(action)}
      />
    );
  }

  return (
    <>
      <AudioController
        track={
          game
            ? zingerAudio(game)
            : {
                url: "/audio/songs/waiting.mp3",
                loop: true,
                key: "lobby",
              }
        }
      />
      {game ? (
        <ZingerGame
          state={game}
          youId={lobby.youId}
          ownerId={lobby.ownerId}
          onSend={send}
        />
      ) : (
        <LobbyView
          lobby={lobby}
          connection={connection}
          shareURL={shareURL}
          onCopyLink={() => void copyRoomLink()}
          onSend={send}
          onLeave={leave}
          onReconnect={() => {
            dismiss();
            setRetry((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
