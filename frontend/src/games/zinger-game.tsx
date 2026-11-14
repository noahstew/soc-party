"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  GamePrompt,
  GameState,
  Player,
} from "@/lib/protocol";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Countdown } from "./countdown";
import { playSoundEffect, zingerEffects } from "@/lib/sound-effects";
import { ZingerLogo } from "@/components/zinger-logo";

import { RevealScene, useVotingScene } from "./zinger-scene";
import { GameOver } from "./zinger-podium";

export function ZingerGame({
  state,
  youId,
  ownerId,
  players,
  onSend,
}: {
  state: GameState;
  youId: string;
  ownerId: string;
  players?: Player[];
  onSend: (message: ClientMessage) => void;
}) {
  // Avatar choices are locked during play; retain the starting roster for leavers.
  const [gamePlayers] = useState(players);
  const lastIntroRound = useRef<number | null>(null);
  useEffect(() => {
    if (
      (state.phase === "round_intro" || state.phase === "final_intro") &&
      lastIntroRound.current !== state.round
    ) {
      lastIntroRound.current = state.round;
      playSoundEffect(zingerEffects.roundStart);
    }
  }, [state.phase, state.round]);
  const sendWithSound = (message: ClientMessage) => {
    if (
      [
        "update_vote",
        "cast_vote",
        "submit_final_votes",
        "submit_answer",
      ].includes(message.type)
    )
      playSoundEffect(zingerEffects.select);
    onSend(message);
  };
  const waiting = state.players.filter(
    (player) => player.connected && !player.finished,
  ).length;
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-8">
      <Card className="p-5 sm:p-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Round {state.round}</p>
            <h1>
              <ZingerLogo />
            </h1>
          </div>
          {["answering", "final_answering", "final_voting"].includes(
            state.phase,
          ) && (
            <Countdown
              deadlineMs={state.deadlineMs}
              serverNowMs={state.serverNowMs}
            />
          )}
        </header>
        {(state.phase === "round_intro" || state.phase === "final_intro") && (
          <Intro state={state} />
        )}
        {(state.phase === "answering" || state.phase === "final_answering") && (
          <Answering prompts={state.prompts ?? []} onSend={sendWithSound} />
        )}
        {state.phase === "matchup_voting" && (
          <MatchupVoting
            key={state.matchupId}
            state={state}
            onSend={sendWithSound}
          />
        )}
        {state.phase === "matchup_reveal" && (
          <RevealScene
            key={`reveal:${state.round}:${state.matchupId}`}
            state={state}
            players={gamePlayers}
          />
        )}
        {state.phase === "round_scoreboard" && (
          <Scoreboard state={state} title="Round scores" />
        )}
        {state.phase === "final_voting" && (
          <FinalVoting state={state} onSend={sendWithSound} />
        )}
        {state.phase === "final_reveal" && (
          <RevealScene key="final-reveal" state={state} players={gamePlayers} />
        )}
        {state.phase === "game_over" && (
          <GameOver state={state} players={gamePlayers} />
        )}
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
  const [draft, setSelected] = useState<string[]>(
    state.selectedAnswerIds ?? [],
  );
  const selected = state.voteSubmitted
    ? (state.selectedAnswerIds ?? [])
    : draft;
  const max = state.maxPicks ?? 0;
  if (max === 0)
    return (
      <p className="py-10 text-center text-xl font-heading">
        No eligible answers. You’re ready.
      </p>
    );
  return (
    <section className="pb-24">
      <h2 className="text-2xl font-heading">Distribute {max} votes</h2>
      <p className="mt-2 text-muted-foreground">
        Click an answer again to add another vote.
      </p>
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
              disabled={state.voteSubmitted}
              variant={active ? "default" : "neutral"}
              className="h-auto min-h-20 whitespace-normal p-4"
              onClick={() => {
                if (selected.length >= max) return;
                playSoundEffect(zingerEffects.select);
                setSelected((current) => [...current, answer.id]);
              }}
            >
              {answer.text}
              <span className="ml-2">
                {selected.filter((id) => id === answer.id).length} votes
              </span>
            </Button>
          );
        })}
      </div>
      {state.voteSubmitted ? (
        <p className="mt-5 text-center font-heading" role="status">
          Votes locked in
        </p>
      ) : (
        selected.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-3xl gap-3 border-t-2 border-border bg-secondary-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              variant="neutral"
              className="flex-1"
              onClick={() => setSelected([])}
            >
              Clear
            </Button>
            {selected.length === max && (
              <Button
                className="flex-1"
                onClick={() =>
                  onSend({
                    type: "submit_final_votes",
                    payload: { answerIds: selected },
                  })
                }
              >
                Submit votes
              </Button>
            )}
          </div>
        )
      )}
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
  const stage = useVotingScene(state);
  const [draft, setSelected] = useState<string | null>(
    state.selectedAnswerIds?.[0] ?? null,
  );
  const selected = state.voteSubmitted
    ? (state.selectedAnswerIds?.[0] ?? null)
    : draft;
  return (
    <section>
      <h2
        className={`scene-question font-heading ${stage === 0 ? "scene-question-large" : "text-center text-xl"}`}
      >
        {state.prompt?.text}
      </h2>
      <div
        hidden={stage !== 3}
        className={stage === 3 ? "mt-3 flex justify-end" : "hidden"}
      >
        <Countdown
          deadlineMs={state.deadlineMs}
          serverNowMs={state.serverNowMs}
        />
      </div>
      {stage === 3 && !state.canVote && (
        <p className="mt-3">Your matchup. The other players are voting.</p>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {state.answers?.map(
          (answer, index) =>
            stage > index && (
              <Button
                key={answer.id}
                variant={selected === answer.id ? "default" : "neutral"}
                aria-pressed={selected === answer.id}
                disabled={stage < 3 || !state.canVote || state.voteSubmitted}
                className={`h-auto min-h-28 whitespace-normal p-5 text-lg ${index === 0 ? "scene-answer-left" : "scene-answer-right"}`}
                onClick={() => {
                  setSelected(answer.id);
                  onSend({
                    type: "update_vote",
                    payload: {
                      matchupId: state.matchupId ?? "",
                      answerId: answer.id,
                    },
                  });
                }}
              >
                {answer.text}
              </Button>
            ),
        )}
      </div>
      {stage === 3 && selected && !state.voteSubmitted && state.canVote && (
        <Button
          className="mt-5 w-full"
          onClick={() =>
            onSend({
              type: "cast_vote",
              payload: { matchupId: state.matchupId ?? "", answerId: selected },
            })
          }
        >
          Submit vote
        </Button>
      )}
      {state.voteSubmitted && (
        <p className="mt-4 text-center font-heading" aria-live="polite">
          Vote locked in
        </p>
      )}
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
  const nextIndex = prompts.findIndex((prompt) => !prompt.submitted);
  if (nextIndex === -1) {
    return (
      <p role="status">All answers submitted. Waiting for the other players…</p>
    );
  }
  const prompt = prompts[nextIndex];
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Question {nextIndex + 1} of {prompts.length}
      </p>
      <AnswerEditor key={prompt.id} prompt={prompt} onSend={onSend} />
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
