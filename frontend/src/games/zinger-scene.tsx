import { useEffect, useState } from "react";
import type { GameAnswer, GameState, Player } from "@/lib/protocol";
import { PlayerAvatar } from "@/components/player-avatar";
import { playSoundEffect, zingerEffects } from "@/lib/sound-effects";

// One clock per scene; snapshots do not restart its effects or choreography.
export function useVotingScene(state: GameState) {
  const [origin] = useState(() => ({
    server: state.serverNowMs,
    local: Date.now(),
    opens: state.votingOpensAtMs ?? state.serverNowMs,
  }));
  const remaining = () =>
    origin.opens - origin.server - (Date.now() - origin.local);
  const [stage, setStage] = useState(() =>
    remaining() > 1000 ? 0 : remaining() > 500 ? 1 : remaining() > 0 ? 2 : 3,
  );
  useEffect(() => {
    const timers = [1000, 500, 0].map((offset, index) => {
      const delay =
        origin.opens - origin.server - (Date.now() - origin.local) - offset;
      if (delay <= 0) return undefined;
      return setTimeout(() => {
        setStage(index + 1);
        if (index < 2) playSoundEffect(zingerEffects.revealAnswer);
      }, delay);
    });
    return () => timers.forEach(clearTimeout);
  }, [origin]);
  return stage;
}

export function RevealScene({
  state,
  players = [],
}: {
  state: GameState;
  players?: Player[];
}) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => {
        setStage(1);
        playSoundEffect(zingerEffects.revealVotes);
      }, 500),
      setTimeout(() => setStage(2), 1500),
      setTimeout(() => {
        setStage(3);
        playSoundEffect(zingerEffects.addPoints);
      }, 2500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <section>
      <h2 className="text-center text-xl font-heading">
        {state.prompt?.text ?? "Final favorites"}
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {state.answers?.map((answer: GameAnswer, index) => {
          const player = players.find((p) => p.id === answer.authorId);
          return (
            <article
              key={answer.id}
              className="relative flex min-h-64 flex-col items-center justify-center overflow-hidden rounded-base border-2 border-border bg-secondary-background px-5 pt-14 pb-5 text-center"
            >
              {stage >= 1 && (
                <p className="scene-pop absolute top-3 left-3 rounded-base bg-secondary px-3 py-1 font-heading">
                  {answer.votes ?? 0} votes
                </p>
              )}
              {state.phase === "final_reveal" && (
                <p className="mb-2 text-sm text-muted-foreground">
                  #{index + 1}
                </p>
              )}
              <p className="text-xl font-heading">{answer.text}</p>
              {stage >= 2 && (
                <div className="scene-pop mt-4 flex flex-col items-center gap-1">
                  {player && (
                    <div className="size-14">
                      <PlayerAvatar
                        avatarId={player.avatarId}
                        name={answer.author ?? player.name}
                      />
                    </div>
                  )}
                  <p className="font-heading">{answer.author}</p>
                </div>
              )}
              {stage >= 3 && (
                <div className="scene-points mt-4 rounded-base bg-main px-4 py-2 font-heading text-main-foreground">
                  <p>+{answer.points ?? 0} points</p>
                  {Boolean(answer.bonus) && <p>Clean sweep! +{answer.bonus}</p>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
