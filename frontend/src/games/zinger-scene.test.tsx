import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ZingerGame } from "./zinger-game";
import type { GameState } from "@/lib/protocol";
import { SOUND_EFFECT_EVENT, zingerEffects } from "@/lib/sound-effects";

afterEach(() => vi.useRealTimers());
const state: GameState = {
  phase: "matchup_voting",
  round: 1,
  multiplierPermille: 1000,
  serverNowMs: 1000,
  votingOpensAtMs: 5000,
  deadlineMs: 25000,
  players: [],
  matchupId: "a",
  canVote: true,
  prompt: { id: "q", text: "The big question", submitted: false },
  answers: [
    { id: "a", text: "Left answer" },
    { id: "b", text: "Right answer" },
  ],
};

it("stages the question and answers before the full voting window, without replay on snapshots", () => {
  vi.useFakeTimers();
  const sound = vi.fn();
  window.addEventListener(SOUND_EFFECT_EVENT, sound);
  const send = vi.fn();
  const { rerender, unmount } = render(
    <ZingerGame state={state} youId="v" ownerId="o" onSend={send} />,
  );
  expect(screen.getByRole("heading", { name: "The big question" })).toHaveClass(
    "scene-question-large",
  );
  expect(screen.queryByRole("button", { name: "Left answer" })).toBeNull();
  expect(screen.queryByLabelText(/seconds remaining/)).not.toBeVisible();
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByRole("button", { name: "Left answer" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Right answer" })).toBeNull();
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByRole("button", { name: "Right answer" })).toBeDisabled();
  expect(sound.mock.calls.map(([event]) => event.detail)).toEqual([
    zingerEffects.revealAnswer,
    zingerEffects.revealAnswer,
  ]);
  rerender(
    <ZingerGame
      state={{ ...state, serverNowMs: 4500 }}
      youId="v"
      ownerId="o"
      onSend={send}
    />,
  );
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByLabelText("20 seconds remaining")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Right answer" }));
  expect(send).toHaveBeenCalledWith({
    type: "update_vote",
    payload: { matchupId: "a", answerId: "b" },
  });
  unmount();
  act(() => vi.runOnlyPendingTimers());
  window.removeEventListener(SOUND_EFFECT_EVENT, sound);
});

it("reveals votes, avatar attribution, then points with their sound cues and no timer", () => {
  vi.useFakeTimers();
  const sound = vi.fn();
  window.addEventListener(SOUND_EFFECT_EVENT, sound);
  render(
    <ZingerGame
      state={{
        ...state,
        phase: "matchup_reveal",
        answers: [
          {
            id: "a",
            text: "Left answer",
            authorId: "p",
            author: "Alex",
            votes: 2,
            points: 300,
          },
        ],
      }}
      players={[{ id: "p", name: "Alex", avatarId: 4, connected: true }]}
      youId="v"
      ownerId="o"
      onSend={() => {}}
    />,
  );
  expect(screen.queryByLabelText(/seconds remaining/)).toBeNull();
  expect(screen.queryByText("2 votes")).toBeNull();
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByText("2 votes")).toBeInTheDocument();
  expect(screen.queryByText("Alex")).toBeNull();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByAltText("Alex avatar")).toHaveAttribute(
    "src",
    expect.stringContaining("4.png"),
  );
  expect(screen.queryByText("+300 points")).toBeNull();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText("+300 points")).toBeInTheDocument();
  expect(sound.mock.calls.map(([event]) => event.detail)).toEqual([
    zingerEffects.revealVotes,
    zingerEffects.addPoints,
  ]);
  window.removeEventListener(SOUND_EFFECT_EVENT, sound);
});

it("skips past entrances on reconnect and cancels remaining cues on leave", () => {
  vi.useFakeTimers();
  const sound = vi.fn();
  window.addEventListener(SOUND_EFFECT_EVENT, sound);
  const { unmount } = render(
    <ZingerGame
      state={{ ...state, serverNowMs: 4600 }}
      youId="v"
      ownerId="o"
      onSend={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: "Left answer" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Right answer" })).toBeDisabled();
  expect(sound).not.toHaveBeenCalled();
  unmount();
  act(() => vi.advanceTimersByTime(1000));
  expect(sound).not.toHaveBeenCalled();
  window.removeEventListener(SOUND_EFFECT_EVENT, sound);
});
