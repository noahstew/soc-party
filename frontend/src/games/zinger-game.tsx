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
        {waiting > 0 && (
          <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
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
