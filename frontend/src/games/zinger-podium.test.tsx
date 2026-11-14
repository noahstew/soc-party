import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GameOver } from "./zinger-podium";
import type { GameState, Player } from "@/lib/protocol";
import { SOUND_EFFECT_EVENT, zingerEffects } from "@/lib/sound-effects";

afterEach(() => vi.useRealTimers());
const state: GameState = {
  phase: "game_over",
  round: 3,
  multiplierPermille: 1000,
  serverNowMs: 0,
  deadlineMs: 0,
  players: ["Gold", "Silver", "Bronze", "Fourth"].map((name, index) => ({
    id: name,
    name,
    score: 400 - index * 100,
    connected: true,
    left: false,
    finished: true,
    roundDelta: 0,
  })),
};

it("reveals third, second, drumroll, first, then all rankings without restarting on snapshots", () => {
  vi.useFakeTimers();
  const sound = vi.fn();
  window.addEventListener(SOUND_EFFECT_EVENT, sound);
  const players: Player[] = state.players.map((player, index) => ({
    id: player.id,
    name: player.name,
    connected: true,
    avatarId: index + 1,
  }));
  const { rerender, unmount } = render(
    <GameOver state={state} players={players} />,
  );
  expect(screen.queryByText("Gold")).toBeNull();
  expect(screen.queryByAltText("Gold avatar")).toBeNull();
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByText("Bronze")).toBeVisible();
  expect(screen.getByAltText("Bronze avatar")).toHaveAttribute(
    "src",
    expect.stringContaining("3.png"),
  );
  expect(screen.queryByText("Silver")).toBeNull();
  rerender(
    <GameOver state={{ ...state, serverNowMs: 500 }} players={players} />,
  );
  act(() => vi.advanceTimersByTime(1500));
  expect(screen.getByText("Silver")).toBeVisible();
  act(() => vi.advanceTimersByTime(1500));
  expect(screen.getByRole("status")).toHaveTextContent("And your winner is");
  expect(screen.queryByText("Gold")).toBeNull();
  act(() => vi.advanceTimersByTime(1500));
  expect(screen.getByText("Gold")).toBeVisible();
  expect(screen.getByAltText("Gold avatar")).toHaveAttribute(
    "src",
    expect.stringContaining("1.png"),
  );
  expect(sound.mock.calls.map(([event]) => event.detail)).toEqual([
    zingerEffects.third,
    zingerEffects.second,
    zingerEffects.drumroll,
    zingerEffects.first,
  ]);
  act(() => vi.advanceTimersByTime(2500));
  expect(screen.getByRole("heading", { name: "Final scores" })).toBeVisible();
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(screen.getAllByRole("img")).toHaveLength(4);
  expect(screen.getByText("#1 Gold ★").closest("li")).toHaveAttribute(
    "data-rank",
    "1",
  );
  unmount();
  window.removeEventListener(SOUND_EFFECT_EVENT, sound);
});

it("cancels all pending sound cues on leaving", () => {
  vi.useFakeTimers();
  const sound = vi.fn();
  window.addEventListener(SOUND_EFFECT_EVENT, sound);
  const { unmount } = render(<GameOver state={state} />);
  unmount();
  act(() => vi.advanceTimersByTime(8000));
  expect(sound).not.toHaveBeenCalled();
  window.removeEventListener(SOUND_EFFECT_EVENT, sound);
});
