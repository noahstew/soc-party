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
