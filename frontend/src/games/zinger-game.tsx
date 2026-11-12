"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientMessage, GamePrompt, GameState } from "@/lib/protocol";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Countdown } from "./countdown";

export function ZingerGame({
  state,
  youId,
  ownerId,
  onSend,
}: {
  state: GameState;
  youId: string;
  ownerId: string;
  onSend: (message: ClientMessage) => void;
}) {
  const waiting = state.players.filter(
    (player) => player.connected && !player.finished,
  ).length;
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-8">
      <Card className="p-5 sm:p-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Round {state.round}</p>
            <h1 className="text-3xl font-heading">Zinger</h1>
          </div>
          <Countdown
            deadlineMs={state.deadlineMs}
            serverNowMs={state.serverNowMs}
          />
        </header>
        {(state.phase === "round_intro" || state.phase === "final_intro") && (
          <Intro state={state} />
        )}
        {(state.phase === "answering" || state.phase === "final_answering") && (
          <Answering prompts={state.prompts ?? []} onSend={onSend} />
        )}
        {state.phase === "matchup_voting" && (
          <MatchupVoting state={state} onSend={onSend} />
        )}
        {state.phase === "matchup_reveal" && <MatchupReveal state={state} />}
        {state.phase === "round_scoreboard" && (
          <Scoreboard state={state} title="Round scores" />
        )}
        {state.phase === "final_voting" && (
          <FinalVoting state={state} onSend={onSend} />
        )}
        {state.phase === "final_reveal" && <FinalReveal state={state} />}
        {state.phase === "game_over" && <GameOver state={state} />}
        {waiting > 0 &&
          [
            "answering",
            "final_answering",
            "matchup_voting",
            "final_voting",
          ].includes(state.phase) && (
            <p
              className="mt-6 text-sm text-muted-foreground"
              aria-live="polite"
            >
              Waiting on {waiting} {waiting === 1 ? "player" : "players"}
            </p>
          )}
        {state.phase === "game_over" && youId === ownerId && (
          <Button
            onClick={() => onSend({ type: "return_to_lobby", payload: {} })}
          >
            Return to lobby
          </Button>
        )}
      </Card>
    </main>
  );
}

function FinalVoting({
  state,
  onSend,
}: {
  state: GameState;
  onSend: (message: ClientMessage) => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    state.selectedAnswerIds ?? [],
  );
  const max = state.maxPicks ?? 0;
  if (max === 0)
    return (
      <p className="py-10 text-center text-xl font-heading">
        No eligible answers. You’re ready.
      </p>
    );
  return (
    <section>
      <h2 className="text-2xl font-heading">Pick up to {max} favorites</h2>
      <p className="mt-2 text-muted-foreground">
        Selected {selected.length}/{max}
      </p>
      <div className="mt-5 grid gap-3">
        {state.answers?.map((answer) => {
          const active = selected.includes(answer.id);
          return (
            <Button
              key={answer.id}
              aria-pressed={active}
              variant={active ? "default" : "neutral"}
              className="h-auto min-h-20 whitespace-normal p-4"
              onClick={() =>
                setSelected((current) =>
                  active
                    ? current.filter((id) => id !== answer.id)
                    : current.length < max
                      ? [...current, answer.id]
                      : current,
                )
              }
            >
              {answer.text}
            </Button>
          );
        })}
      </div>
      <Button
        className="mt-5 w-full"
        disabled={selected.length === 0}
        onClick={() =>
          onSend({
            type: "submit_final_votes",
            payload: { answerIds: selected },
          })
        }
      >
        {state.selectedAnswerIds ? "Update favorites" : "Submit favorites"}
      </Button>
    </section>
  );
}

function FinalReveal({ state }: { state: GameState }) {
  return (
    <section>
      <h2 className="text-2xl font-heading">Final favorites</h2>
      <ol className="mt-5 space-y-4">
        {state.answers?.map((answer, index) => (
          <li
            key={answer.id}
            className="rounded-base border-2 border-border bg-secondary-background p-4"
          >
            <p className="font-heading">
              #{index + 1} · {answer.text}
            </p>
            <p className="mt-2">
              {answer.author} · {answer.votes ?? 0} votes · +
              {answer.points ?? 0}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GameOver({ state }: { state: GameState }) {
  const players = [...state.players].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  );
  const ranked = players.map((player) => ({
    ...player,
    rank:
      players.findIndex((candidate) => candidate.score === player.score) + 1,
  }));
  return (
    <section>
      <h2 className="text-center text-3xl font-heading">Final scores</h2>
      <ol className="mt-6 space-y-3">
        {ranked.map((player) => {
          return (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-base border-2 border-border bg-secondary-background p-4"
            >
              <span className="font-heading">
                #{player.rank} {player.name}
                {player.rank <= 3 ? " ★" : ""}
              </span>
              <span>{player.score} points</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MatchupVoting({
  state,
  onSend,
}: {
  state: GameState;
  onSend: (message: ClientMessage) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <section>
      <h2 className="text-xl font-heading">{state.prompt?.text}</h2>
      {!state.canVote && (
        <p className="mt-3">Your matchup. The other players are voting.</p>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {state.answers?.map((answer) => (
          <Button
            key={answer.id}
            variant={selected === answer.id ? "default" : "neutral"}
            disabled={!state.canVote || selected !== null}
            className="h-auto min-h-28 whitespace-normal p-5 text-lg"
            onClick={() => {
              setSelected(answer.id);
              onSend({
                type: "cast_vote",
                payload: {
                  matchupId: state.matchupId ?? "",
                  answerId: answer.id,
                },
              });
            }}
          >
            {answer.text}
          </Button>
        ))}
      </div>
      {selected && (
        <p className="mt-4 text-center font-heading" aria-live="polite">
          Vote locked in
        </p>
      )}
    </section>
  );
}

function MatchupReveal({ state }: { state: GameState }) {
  return (
    <section>
      <h2 className="text-xl font-heading">{state.prompt?.text}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {state.answers?.map((answer) => (
          <article
            key={answer.id}
            className="rounded-base border-2 border-border bg-secondary-background p-5"
          >
            <p className="text-lg">{answer.text}</p>
            <p className="mt-4 font-heading">{answer.author}</p>
            <p>
              {answer.votes ?? 0} votes · +{answer.points ?? 0} points
            </p>
            {Boolean(answer.bonus) && (
              <p className="mt-3 rounded-base bg-main p-2 text-center font-heading text-main-foreground">
                Clean sweep! +{answer.bonus}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function Scoreboard({ state, title }: { state: GameState; title: string }) {
  const players = [...state.players].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  );
  return (
    <section>
      <h2 className="text-2xl font-heading">{title}</h2>
      <ol className="mt-5 space-y-3">
        {players.map((player) => (
          <li
            key={player.id}
            className="flex items-center justify-between rounded-base border-2 border-border bg-secondary-background p-3"
          >
            <span>
              {player.name}
              {player.left ? " (left)" : ""}
            </span>
            <span className="font-heading">
              {player.score}{" "}
              <small className="text-muted-foreground">
                (+{player.roundDelta})
              </small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Intro({ state }: { state: GameState }) {
  const multiplier = state.multiplierPermille / 1000;
  return (
    <div className="py-12 text-center">
      <p className="text-5xl font-heading">
        {state.round === 3 ? "Final round" : `Round ${state.round}`}
      </p>
      <p className="mt-4 text-xl">{multiplier}x points</p>
    </div>
  );
}

function Answering({
  prompts,
  onSend,
}: {
  prompts: GamePrompt[];
  onSend: (message: ClientMessage) => void;
}) {
  return (
    <div className="space-y-6">
      {prompts.map((prompt) => (
        <AnswerEditor key={prompt.id} prompt={prompt} onSend={onSend} />
      ))}
    </div>
  );
}

function AnswerEditor({
  prompt,
  onSend,
}: {
  prompt: GamePrompt;
  onSend: (message: ClientMessage) => void;
}) {
  const [text, setText] = useState(prompt.draft ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const update = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () =>
        onSend({
          type: "update_draft",
          payload: { promptId: prompt.id, text: value },
        }),
      250,
    );
  };
  return (
    <section>
      <label className="block font-heading" htmlFor={`answer-${prompt.id}`}>
        {prompt.text}
      </label>
      <textarea
        id={`answer-${prompt.id}`}
        value={text}
        disabled={prompt.submitted}
        maxLength={100}
        onChange={(event) => update(event.target.value)}
        className="mt-2 min-h-28 w-full rounded-base border-2 border-border bg-input-background p-3 focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {Array.from(text).length}/100
        </span>
        <Button
          disabled={prompt.submitted || text.trim().length === 0}
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            onSend({
              type: "submit_answer",
              payload: { promptId: prompt.id, text },
            });
          }}
        >
          {prompt.submitted ? "Submitted" : "Submit answer"}
        </Button>
      </div>
    </section>
  );
}
