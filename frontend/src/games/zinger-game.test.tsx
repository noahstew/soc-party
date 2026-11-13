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
  it("renders only the unanswered prompt, countdown, counters and waiting status", () => {
    render(
      <ZingerGame state={state} youId="p1" ownerId="p1" onSend={() => {}} />,
    );
    expect(screen.getByLabelText("First prompt")).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Zinger" })).toContainElement(
      screen.getByRole("img", { name: "Zinger" }),
    );
    expect(screen.queryByLabelText("Second prompt")).not.toBeInTheDocument();
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("0/100")).toBeInTheDocument();
    expect(screen.getByText("Waiting on 1 player")).toBeInTheDocument();
    expect(screen.getByLabelText(/seconds remaining/)).toBeInTheDocument();
  });
  it("advances the server-corrected countdown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    render(
      <ZingerGame
        state={{ ...state, deadlineMs: 4_000, serverNowMs: 1_000 }}
        youId="p1"
        ownerId="p1"
        onSend={() => {}}
      />,
    );
    expect(screen.getByLabelText("3 seconds remaining")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByLabelText("2 seconds remaining")).toBeInTheDocument();
    vi.useRealTimers();
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
  it("advances after server confirmation and waits after the last submission", () => {
    const send = vi.fn();
    const prompts = [
      {
        id: "a",
        text: "First prompt",
        draft: "First answer",
        submitted: false,
      },
      {
        id: "b",
        text: "Second prompt",
        draft: "Saved draft",
        submitted: false,
      },
    ];
    const view = (nextPrompts: typeof prompts) => (
      <ZingerGame
        state={{ ...state, prompts: nextPrompts }}
        youId="p1"
        ownerId="p1"
        onSend={send}
      />
    );
    const { rerender } = render(view(prompts));
    expect(screen.queryByLabelText("Second prompt")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(send).toHaveBeenLastCalledWith({
      type: "submit_answer",
      payload: { promptId: "a", text: "First answer" },
    });
    // Keep the answer available for retry until the server accepts it.
    expect(screen.getByLabelText("First prompt")).toHaveValue("First answer");
    const confirmed = [{ ...prompts[0], submitted: true }, prompts[1]];
    rerender(view(confirmed));
    expect(screen.queryByLabelText("First prompt")).not.toBeInTheDocument();
    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Second prompt")).toHaveValue("Saved draft");
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(send).toHaveBeenLastCalledWith({
      type: "submit_answer",
      payload: { promptId: "b", text: "Saved draft" },
    });
    rerender(view(confirmed.map((prompt) => ({ ...prompt, submitted: true }))));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "All answers submitted",
    );
  });
  it("resumes at the next unanswered prompt after reconnecting", () => {
    render(
      <ZingerGame
        state={{
          ...state,
          prompts: [
            { ...state.prompts![0], submitted: true },
            { ...state.prompts![1], submitted: false },
          ],
        }}
        youId="p1"
        ownerId="p1"
        onSend={() => {}}
      />,
    );
    expect(screen.queryByLabelText("First prompt")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Second prompt")).toHaveValue("locked");
    expect(screen.getByText("Question 2 of 2")).toBeInTheDocument();
  });
  it("shows a waiting state for a confirmed final-round answer", () => {
    render(
      <ZingerGame
        state={{
          ...state,
          phase: "final_answering",
          prompts: [{ ...state.prompts![0], submitted: true }],
        }}
        youId="p1"
        ownerId="p1"
        onSend={() => {}}
      />,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "All answers submitted",
    );
  });
});

describe("Zinger head-to-head views", () => {
  it("shows the prompt and locked answers to matchup authors during voting", () => {
    const send = vi.fn();
    render(
      <ZingerGame
        state={{
          ...state,
          phase: "matchup_voting",
          canVote: false,
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
    expect(
      screen.getByRole("heading", { name: "Pick one" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The other players are voting/),
    ).toBeInTheDocument();
    for (const name of ["Alpha", "Beta"]) {
      const answer = screen.getByRole("button", { name });
      expect(answer).toBeDisabled();
      fireEvent.click(answer);
    }
    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByText("Vote locked in")).not.toBeInTheDocument();
  });

  it("lets voters change selection before explicit submission", () => {
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
    expect(send).toHaveBeenLastCalledWith({
      type: "update_vote",
      payload: { matchupId: "m1", answerId: "a1" },
    });
    expect(screen.queryByText("Vote locked in")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit vote" }));
    expect(send).toHaveBeenLastCalledWith({
      type: "cast_vote",
      payload: { matchupId: "m1", answerId: "a2" },
    });
  });
  it("restores a submitted single vote as locked", () => {
    const send = vi.fn();
    render(
      <ZingerGame
        state={{
          ...state,
          phase: "matchup_voting",
          matchupId: "m1",
          canVote: true,
          voteSubmitted: true,
          selectedAnswerIds: ["a2"],
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
    expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Alpha" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Submit vote" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Vote locked in")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(send).not.toHaveBeenCalled();
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
  it("requires three votes, supports stacking and clears the ballot", () => {
    const send = vi.fn();
    render(
      <ZingerGame
        state={{
          ...state,
          phase: "final_voting",
          round: 3,
          answers,
          maxPicks: 3,
        }}
        youId="p1"
        ownerId="p1"
        onSend={send}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Clear" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit votes" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Selected 0/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));
    fireEvent.click(screen.getByRole("button", { name: /Beta/ }));
    fireEvent.click(screen.getByRole("button", { name: /Gamma/ }));
    expect(screen.getByText("Selected 3/3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveTextContent(
      "2 votes",
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit votes" }));
    expect(send).toHaveBeenCalledWith({
      type: "submit_final_votes",
      payload: { answerIds: ["a1", "a1", "a2"] },
    });
  });
  it("restores locked final ballots from server snapshots", () => {
    render(
      <ZingerGame
        state={{
          ...state,
          phase: "final_voting",
          round: 3,
          answers,
          maxPicks: 3,
          selectedAnswerIds: ["a1", "a1", "a1"],
          voteSubmitted: true,
        }}
        youId="p1"
        ownerId="p1"
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveTextContent(
      "3 votes",
    );
    expect(screen.getByText("Votes locked in")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear" }),
    ).not.toBeInTheDocument();
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
