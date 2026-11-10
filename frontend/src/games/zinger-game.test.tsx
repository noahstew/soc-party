import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameState } from "@/lib/protocol";
import { ZingerGame } from "./zinger-game";

const state: GameState = {
  phase: "answering",
  round: 1,
  multiplierPermille: 1000,
  deadlineMs: Date.now() + 10_000,
  serverNowMs: Date.now(),
  players: [
    {
      id: "p1",
      name: "Alex",
      connected: true,
      left: false,
      score: 0,
      roundDelta: 0,
      finished: false,
    },
    {
      id: "p2",
      name: "Bea",
      connected: true,
      left: false,
      score: 0,
      roundDelta: 0,
      finished: true,
    },
  ],
  prompts: [
    { id: "a", text: "First prompt", draft: "", submitted: false },
    { id: "b", text: "Second prompt", draft: "locked", submitted: true },
  ],
};

describe("Zinger answering", () => {
  it("renders prompts, countdown, counters and waiting status", () => {
    render(
      <ZingerGame state={state} youId="p1" ownerId="p1" onSend={() => {}} />,
    );
    expect(screen.getByLabelText("First prompt")).toBeEnabled();
    expect(screen.getByLabelText("Second prompt")).toBeDisabled();
    expect(screen.getByText("Waiting on 1 player")).toBeInTheDocument();
    expect(screen.getByLabelText(/seconds remaining/)).toBeInTheDocument();
  });
  it("debounces drafts and submits the current answer", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    render(<ZingerGame state={state} youId="p1" ownerId="p1" onSend={send} />);
    fireEvent.change(screen.getByLabelText("First prompt"), {
      target: { value: "hello" },
    });
    act(() => vi.advanceTimersByTime(249));
    expect(send).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(send).toHaveBeenCalledWith({
      type: "update_draft",
      payload: { promptId: "a", text: "hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(send).toHaveBeenLastCalledWith({
      type: "submit_answer",
      payload: { promptId: "a", text: "hello" },
    });
    vi.useRealTimers();
  });
});

describe("Zinger head-to-head views", () => {
  it("casts one vote and shows confirmation", () => {
    const send = vi.fn();
    render(
      <ZingerGame
        state={{
          ...state,
          phase: "matchup_voting",
          canVote: true,
          matchupId: "m1",
          prompt: { id: "q", text: "Pick one", submitted: false },
          prompts: undefined,
          answers: [
            { id: "a1", text: "Alpha" },
            { id: "a2", text: "Beta" },
          ],
        }}
        youId="p1"
        ownerId="p1"
        onSend={send}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(send).toHaveBeenCalledWith({
      type: "cast_vote",
      payload: { matchupId: "m1", answerId: "a1" },
    });
    expect(screen.getByText("Vote locked in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta" })).toBeDisabled();
  });
  it("renders attributed reveal, empty placeholder and original bonus copy", () => {
    render(
      <ZingerGame
        state={{
          ...state,
          phase: "matchup_reveal",
          prompt: { id: "q", text: "Reveal", submitted: false },
          prompts: undefined,
          answers: [
            {
              id: "a1",
              text: "No answer submitted",
              author: "Alex",
              votes: 0,
              points: 0,
            },
            {
              id: "a2",
              text: "Winner",
              author: "Bea",
              votes: 1,
              points: 200,
              bonus: 100,
            },
          ],
        }}
        youId="p1"
        ownerId="p1"
        onSend={() => {}}
      />,
    );
    expect(screen.getByText("No answer submitted")).toBeInTheDocument();
    expect(screen.getByText("Clean sweep! +100")).toBeInTheDocument();
    expect(screen.getByText("1 votes · +200 points")).toBeInTheDocument();
  });
  it("orders the round scoreboard by total score", () => {
    render(
      <ZingerGame
        state={{
          ...state,
          phase: "round_scoreboard",
          players: [
            { ...state.players[0], score: 100, roundDelta: 100 },
            { ...state.players[1], score: 200, roundDelta: 200 },
          ],
        }}
        youId="p1"
        ownerId="p1"
        onSend={() => {}}
      />,
    );
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Bea");
  });
});

describe("Zinger final views", () => {
  const answers = [
    { id: "a1", text: "Alpha" },
    { id: "a2", text: "Beta" },
    { id: "a3", text: "Gamma" },
    { id: "a4", text: "Delta" },
  ];
  it("limits favorite selection and allows resubmission", () => {
    const send = vi.fn();
    render(
      <ZingerGame
        state={{
          ...state,
          phase: "final_voting",
          round: 3,
          multiplierPermille: 2000,
          prompts: undefined,
          answers,
          maxPicks: 3,
          selectedAnswerIds: ["a1"],
        }}
        youId="p1"
        ownerId="p1"
        onSend={send}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    fireEvent.click(screen.getByRole("button", { name: "Gamma" }));
    fireEvent.click(screen.getByRole("button", { name: "Delta" }));
    expect(screen.getByText("Selected 3/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update favorites" }));
    expect(send).toHaveBeenCalledWith({
      type: "submit_final_votes",
      payload: { answerIds: ["a1", "a2", "a3"] },
    });
  });
  it("renders ranked final answers", () => {
    render(
      <ZingerGame
        state={{
          ...state,
          phase: "final_reveal",
          round: 3,
          multiplierPermille: 2000,
          prompts: undefined,
          answers: [
            { id: "a1", text: "Winner", author: "Alex", votes: 2, points: 400 },
            {
              id: "a2",
              text: "Runner up",
              author: "Bea",
              votes: 1,
              points: 200,
            },
          ],
        }}
        youId="p1"
        ownerId="p1"
        onSend={() => {}}
      />,
    );
    expect(screen.getByText("#1 · Winner")).toBeInTheDocument();
    expect(screen.getByText("Alex · 2 votes · +400")).toBeInTheDocument();
  });
  it("shares competition ranks on tied final scores and limits return to owner", () => {
    const send = vi.fn();
    const players = [
      { ...state.players[0], score: 500 },
      { ...state.players[1], score: 500 },
      { ...state.players[1], id: "p3", name: "Cam", score: 200 },
    ];
    const { rerender } = render(
      <ZingerGame
        state={{
          ...state,
          phase: "game_over",
          round: 3,
          multiplierPermille: 2000,
          players,
          prompts: undefined,
        }}
        youId="p1"
        ownerId="p1"
        onSend={send}
      />,
    );
    expect(screen.getByText("#1 Alex ★")).toBeInTheDocument();
    expect(screen.getByText("#1 Bea ★")).toBeInTheDocument();
    expect(screen.getByText("#3 Cam ★")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to lobby" }));
    expect(send).toHaveBeenCalledWith({ type: "return_to_lobby", payload: {} });
    rerender(
      <ZingerGame
        state={{
          ...state,
          phase: "game_over",
          round: 3,
          multiplierPermille: 2000,
          players,
          prompts: undefined,
        }}
        youId="p2"
        ownerId="p1"
        onSend={send}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Return to lobby" }),
    ).not.toBeInTheDocument();
  });
});
