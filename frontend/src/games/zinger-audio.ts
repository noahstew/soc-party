import type { GameState } from "@/lib/protocol";
import type { AudioTrack } from "@/lib/use-audio";

export function zingerAudio(state: GameState): AudioTrack | null {
  if (state.phase === "answering" || state.phase === "final_answering") {
    return {
      url: "/audio/songs/zinger/gameplay.mp3",
      loop: true,
      key: `answering:${state.round}`,
    };
  }
  if (state.phase === "matchup_voting" || state.phase === "final_voting") {
    return {
      url: "/audio/songs/zinger/voting.mp3",
      loop: false,
      key: `voting:${state.round}:${state.matchupId ?? "final"}`,
    };
  }
  return null;
}
