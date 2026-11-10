"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Brand } from "@/components/brand";
import { ChoiceGrid } from "@/components/choice-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { ClientMessage, Lobby, Player } from "@/lib/protocol";

type Tab = "lobby" | "room" | "game";
type Props = {
  lobby: Lobby;
  connection: "connecting" | "connected" | "disconnected";
  shareURL: string;
  onCopyLink: () => void;
  onSend: (message: ClientMessage) => void;
  onLeave: () => void;
  onReconnect: () => void;
};

function subscribeToDesktop(callback: () => void) {
  const query = window.matchMedia?.("(min-width: 768px)");
  query?.addEventListener("change", callback);
  return () => query?.removeEventListener("change", callback);
}
function desktopSnapshot() {
  return window.matchMedia?.("(min-width: 768px)").matches ?? false;
}

function Icon({ name }: { name: "person" | "crown" | "copy" | "x" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
    >
      {name === "person" && (
        <>
          <circle cx="12" cy="7" r="4" />
          <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
        </>
      )}
      {name === "crown" && (
        <>
          <path d="m3 6 5 4 4-7 4 7 5-4-3 12H6Z" />
          <path d="M7 22h10" />
        </>
      )}
      {name === "copy" && (
        <>
          <rect x="8" y="8" width="13" height="13" rx="2" />
          <path d="M16 8V3H3v13h5" />
        </>
      )}
      {name === "x" && <path d="m6 6 12 12M6 18 18 6" />}
    </svg>
  );
}

function SelectionCheck({ label }: { label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-chart-4 text-secondary-background"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="size-4"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    </span>
  );
}

export function LobbyView({
  lobby,
  connection,
  shareURL,
  onCopyLink,
  onSend,
  onLeave,
  onReconnect,
}: Props) {
  const desktop = useSyncExternalStore(
    subscribeToDesktop,
    desktopSnapshot,
    () => false,
  );
  const [mobileTab, setMobileTab] = useState<Tab>("lobby");
  const [settingsTab, setSettingsTab] = useState<"room" | "game">("room");
  const tablist = useRef<HTMLDivElement>(null);
  const activeTab = desktop ? settingsTab : mobileTab;
  const tabs: Tab[] = desktop ? ["room", "game"] : ["lobby", "room", "game"];
  const owner = lobby.youId === lobby.ownerId;
  const editable = owner && connection === "connected";
  const you = lobby.players.find((player) => player.id === lobby.youId);
  const others = lobby.players.filter((player) => player.id !== lobby.youId);
  const connected = lobby.players.filter((player) => player.connected).length;
  const currentGame = lobby.games.find((game) => game.id === lobby.gameId);
  const selectedPacks = new Set(lobby.selectedPackSlugs);

  function selectTab(tab: Tab) {
    setMobileTab(tab);
    if (tab !== "lobby") setSettingsTab(tab);
  }

  function playerCard(player: Player, self = false) {
    return (
      <div
        className={`flex items-center gap-3 rounded-base border-2 p-3 ${self ? "border-main bg-main/5" : "border-border bg-input-background"}`}
      >
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-base border-2 ${self ? "border-main text-main-ink" : "border-border text-muted-foreground"}`}
        >
          <Icon name="person" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-heading">{player.name}</span>
            {player.id === lobby.ownerId && (
              <span
                role="img"
                aria-label="Room owner"
                title="Room owner"
                className="text-chart-3"
              >
                <Icon name="crown" />
              </span>
            )}
          </div>
          {!player.connected && (
            <p className="mt-1 text-xs text-muted-foreground">Reconnecting…</p>
          )}
        </div>
        {owner && !self && (
          <Button
            variant="neutral"
            size="icon"
            className="shrink-0 rounded-full shadow-none"
            disabled={connection !== "connected"}
            aria-label={`Remove ${player.name}`}
            onClick={() =>
              onSend({ type: "kick_player", payload: { playerId: player.id } })
            }
          >
            <Icon name="x" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Room lobby" className="space-y-8">
      <h1 className="text-center">
        <Brand />
      </h1>
      <Card className="lobby-card gap-0 overflow-hidden p-0">
        <div className="lobby-grid">
          <div
            ref={tablist}
            role="tablist"
            aria-label="Lobby sections"
            className="lobby-tabs flex gap-2 border-b-2 border-border p-3 md:px-6 md:pt-6"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const index = tabs.indexOf(activeTab);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
              selectTab(tabs[next]);
              tablist.current
                ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [next]?.focus();
            }}
          >
            {tabs.map((tab) => (
              <Button
                key={tab}
                id={`tab-${tab}`}
                role="tab"
                aria-controls={`panel-${tab}`}
                aria-selected={activeTab === tab}
                tabIndex={activeTab === tab ? 0 : -1}
                variant={activeTab === tab ? "default" : "neutral"}
                className="flex-1 shadow-none"
                onClick={() => selectTab(tab)}
              >
                {tab === "lobby" ? "Lobby" : tab === "room" ? "Room" : "Game"}
              </Button>
            ))}
          </div>
          <div
            id="panel-lobby"
            role={desktop ? "region" : "tabpanel"}
            aria-label={desktop ? "Lobby" : undefined}
            aria-labelledby={desktop ? undefined : "tab-lobby"}
            hidden={!desktop && activeTab !== "lobby"}
            tabIndex={0}
            className="lobby-players min-w-0 space-y-6 p-5 sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Room code</p>
                <p
                  aria-label={`Room code ${lobby.code}`}
                  className="font-mono text-[clamp(2rem,7vw,3.5rem)] leading-tight font-bold tracking-wider text-main-ink"
                >
                  {lobby.code}
                </p>
              </div>
              <Button
                variant="neutral"
                size="icon-lg"
                disabled={!shareURL}
                onClick={onCopyLink}
                aria-label="Copy URL"
                title="Copy room link"
              >
                <Icon name="copy" />
              </Button>
            </div>
            <div
              aria-label={`Players (${lobby.players.length}/${lobby.maxPlayers})`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm">Players</h2>
                <span
                  aria-label={`${connected} people connected`}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Icon name="person" />
                  {connected}/{lobby.maxPlayers}
                </span>
              </div>
              {you && playerCard(you, true)}
              <ul
                aria-label="Players in room"
                className="mt-3 max-h-72 space-y-3 overflow-y-auto overscroll-contain p-1 -m-1"
              >
                {others.map((player) => (
                  <li key={player.id}>{playerCard(player)}</li>
                ))}
              </ul>
            </div>
          </div>
          <div
            className="lobby-settings min-w-0 p-5 sm:p-7"
            hidden={activeTab === "lobby" && !desktop}
          >
            <div
              id="panel-room"
              role="tabpanel"
              aria-labelledby="tab-room"
              tabIndex={0}
              hidden={activeTab !== "room"}
              className="space-y-6"
            >
              <Select
                label="Room size"
                value={String(lobby.maxPlayers)}
                disabled={!editable}
                options={[3, 4, 5, 6, 7, 8].map((size) => ({
                  value: String(size),
                  label: `${size} players`,
                  disabled: size < lobby.players.length,
                }))}
                onValueChange={(value) =>
                  onSend({
                    type: "update_settings",
                    payload: { maxPlayers: Number(value) },
                  })
                }
              />
              <fieldset>
                <legend className="mb-3 text-sm font-heading">Game</legend>
                <ChoiceGrid label="Available games">
                  {lobby.games.map((game) => (
                    <Button
                      key={game.id}
                      aria-pressed={lobby.gameId === game.id}
                      aria-label={game.title}
                      disabled={!editable}
                      variant={lobby.gameId === game.id ? "default" : "neutral"}
                      onClick={() =>
                        onSend({
                          type: "select_game",
                          payload: { gameId: game.id },
                        })
                      }
                      className="relative h-24 min-w-0 px-3 pr-8 text-lg whitespace-normal [overflow-wrap:anywhere]"
                    >
                      {game.title}
                      {lobby.gameId === game.id && (
                        <SelectionCheck label="Game selected" />
                      )}
                    </Button>
                  ))}
                </ChoiceGrid>
              </fieldset>
            </div>
            <div
              id="panel-game"
              role="tabpanel"
              aria-labelledby="tab-game"
              tabIndex={0}
              hidden={activeTab !== "game"}
            >
              <fieldset>
                <legend className="mb-3 text-sm font-heading">
                  {currentGame ? `${currentGame.title} packs` : "Game packs"}
                </legend>
                <ChoiceGrid label="Available packs" tileSize="lg">
                  {currentGame?.packs.map((pack) => (
                    <Button
                      key={pack.slug}
                      aria-pressed={selectedPacks.has(pack.slug)}
                      aria-label={`${pack.title} pack`}
                      disabled={!editable}
                      variant={
                        selectedPacks.has(pack.slug) ? "default" : "neutral"
                      }
                      onClick={() =>
                        onSend({
                          type: "select_pack",
                          payload: {
                            gameId: lobby.gameId,
                            packSlug: pack.slug,
                            selected: !selectedPacks.has(pack.slug),
                          },
                        })
                      }
                      className="relative h-28 min-w-0 px-3 pr-8 text-lg whitespace-normal [overflow-wrap:anywhere]"
                    >
                      {pack.title}
                      {selectedPacks.has(pack.slug) && (
                        <SelectionCheck label="Pack selected" />
                      )}
                    </Button>
                  ))}
                </ChoiceGrid>
              </fieldset>
              {lobby.selectedPackSlugs.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Select at least one pack to start.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t-2 border-border bg-input-background px-5 py-4 sm:px-7">
          <div className="flex gap-3">
            {connection === "disconnected" && (
              <Button onClick={onReconnect}>Reconnect</Button>
            )}
            <Button variant="neutral" onClick={onLeave}>
              Leave room
            </Button>
            {lobby.youId === lobby.ownerId && (
              <Button
                disabled={!lobby.canStart || connection !== "connected"}
                onClick={() => onSend({ type: "start_game", payload: {} })}
              >
                Start game
              </Button>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
