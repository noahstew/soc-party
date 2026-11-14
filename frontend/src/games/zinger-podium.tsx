import { useEffect, useState } from "react";
import type { GameState, Player } from "@/lib/protocol";
import { PlayerAvatar } from "@/components/player-avatar";
import { playSoundEffect, zingerEffects } from "@/lib/sound-effects";

export function GameOver({
  state,
  players: roster = [],
}: {
  state: GameState;
  players?: Player[];
}) {
  const [stage, setStage] = useState(0);
  const players = [...state.players].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  );
  const ranked = players.map((player) => ({
    ...player,
    rank:
      players.findIndex((candidate) => candidate.score === player.score) + 1,
  }));
  const ranks = ranked.map((player) => player.rank).join(",");
  const avatar = (id: string, name: string, podium = false) => {
    const player = roster.find((candidate) => candidate.id === id);
    return player ? (
      <div
        className={
          podium ? "mx-auto mb-2 size-16 sm:size-22" : "size-10 shrink-0"
        }
      >
        <PlayerAvatar avatarId={player.avatarId} name={name} />
      </div>
    ) : null;
  };
  useEffect(() => {
    const present = new Set(ranks.split(",").map(Number));
    const cues = [
      { at: 500, stage: 1, rank: 3, sound: zingerEffects.third },
      { at: 2000, stage: 2, rank: 2, sound: zingerEffects.second },
      { at: 3500, stage: 3, rank: 1, sound: zingerEffects.drumroll },
      { at: 5000, stage: 4, rank: 1, sound: zingerEffects.first },
      { at: 7500, stage: 5, rank: 0, sound: null },
    ];
    const timers = cues.map((cue) =>
      setTimeout(() => {
        setStage(cue.stage);
        if (cue.sound && present.has(cue.rank)) playSoundEffect(cue.sound);
      }, cue.at),
    );
    return () => timers.forEach(clearTimeout);
    // Capture the final ranks once; room snapshots must not replay the ceremony.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (stage === 5)
    return (
      <section className="scene-pop">
        <h2 className="text-center text-3xl font-heading">Final scores</h2>
        <ol className="mt-6 space-y-3">
          {ranked.map((player) => (
            <li
              key={player.id}
              data-rank={player.rank}
              className="podium-medal flex flex-wrap items-center justify-between gap-2 rounded-base border-2 border-border bg-secondary-background p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                {avatar(player.id, player.name)}
                <span className="font-heading break-words">
                  #{player.rank} {player.name}
                  {player.rank <= 3 ? " ★" : ""}
                </span>
              </div>
              <span>{player.score} points</span>
            </li>
          ))}
        </ol>
      </section>
    );

  return (
    <section aria-label="Podium reveal" className="py-6 text-center">
      <h2 className="text-3xl font-heading">The podium</h2>
      <p role="status" className="mt-3 min-h-7 font-heading">
        {stage === 0
          ? "Here come your champions…"
          : stage === 3
            ? "And your winner is…"
            : stage === 4
              ? "Your champions!"
              : "Taking their place…"}
      </p>
      <div
        aria-live="polite"
        className="mt-8 grid min-h-80 grid-cols-3 items-end gap-2 sm:gap-4"
      >
        {[2, 1, 3].map((rank) => {
          const revealed = stage >= (rank === 3 ? 1 : rank === 2 ? 2 : 4);
          return (
            <div key={rank} className="min-w-0">
              {revealed &&
                ranked
                  .filter((player) => player.rank === rank)
                  .map((player) => (
                    <div
                      key={player.id}
                      className="podium-name mb-3 break-words"
                    >
                      {avatar(player.id, player.name, true)}
                      <p className="text-lg font-heading sm:text-2xl">
                        {player.name}
                      </p>
                      <p className="text-sm">{player.score} points</p>
                    </div>
                  ))}
              <div
                data-rank={rank}
                data-revealed={revealed}
                className="podium-step podium-medal flex items-start justify-center rounded-t-base border-2 border-border pt-5 text-4xl font-heading"
                style={{ height: rank === 1 ? 180 : rank === 2 ? 130 : 90 }}
              >
                <span aria-label={`Place ${rank}`}>
                  {rank === 1 && stage === 3 ? "?" : rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
