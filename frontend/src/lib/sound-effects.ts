export const zingerEffects = {
  roundStart: "/audio/sound-effects/zinger/round-start.mp3",
  select: "/audio/sound-effects/zinger/select.mp3",
  addPoints: "/audio/sound-effects/zinger/add-points.mp3",
  drumroll: "/audio/sound-effects/zinger/drumroll.mp3",
  first: "/audio/sound-effects/zinger/first.mp3",
  second: "/audio/sound-effects/zinger/second.mp3",
  third: "/audio/sound-effects/zinger/third.mp3",
  revealAnswer: "/audio/sound-effects/zinger/reveal-answer.mp3",
  revealVotes: "/audio/sound-effects/zinger/reveal-votes.mp3",
} as const;

export const SOUND_EFFECT_EVENT = "partisocial:sound-effect";
export function playSoundEffect(url: string) {
  window.dispatchEvent(new CustomEvent(SOUND_EFFECT_EVENT, { detail: url }));
}
