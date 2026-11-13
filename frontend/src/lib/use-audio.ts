"use client";

import { useEffect, useRef } from "react";
import { SOUND_EFFECT_EVENT } from "./sound-effects";

export type AudioTrack = { url: string; loop: boolean; key: string };

// One audio context and decoded-buffer cache per room visit, shared by all phases.
export function useAudio(
  track: AudioTrack | null,
  volume: number,
  muted: boolean,
  effectsVolume = 1,
) {
  const engine = useRef<{
    context: AudioContext;
    gain: GainNode;
    effectsGain: GainNode;
    buffers: Map<string, Promise<AudioBuffer>>;
    signal: AbortSignal;
  } | null>(null);

  useEffect(() => {
    if (typeof AudioContext === "undefined") return;
    const context = new AudioContext();
    const gain = context.createGain();
    gain.connect(context.destination);
    const effectsGain = context.createGain();
    effectsGain.connect(context.destination);
    const controller = new AbortController();
    engine.current = {
      context,
      gain,
      effectsGain,
      buffers: new Map(),
      signal: controller.signal,
    };
    const sources = new Set<AudioBufferSourceNode>();
    const effect = (event: Event) => {
      const url = (event as CustomEvent<string>).detail;
      const audio = engine.current;
      if (!audio || effectsGain.gain.value === 0) return;
      if (context.state === "suspended") void context.resume().catch(() => {});
      let buffer = audio.buffers.get(url);
      if (!buffer) {
        buffer = (async () => {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error("Audio unavailable");
          return context.decodeAudioData(await response.arrayBuffer());
        })();
        audio.buffers.set(url, buffer);
      }
      void buffer
        .then((decoded) => {
          if (controller.signal.aborted) return;
          const source = context.createBufferSource();
          source.buffer = decoded;
          source.connect(effectsGain);
          sources.add(source);
          source.onended = () => {
            sources.delete(source);
            source.disconnect();
          };
          source.start();
        })
        .catch(() => {
          audio.buffers.delete(url);
        });
    };
    window.addEventListener(SOUND_EFFECT_EVENT, effect);
    const resume = () => {
      if (context.state === "suspended") void context.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    resume();
    return () => {
      controller.abort();
      window.removeEventListener(SOUND_EFFECT_EVENT, effect);
      sources.forEach((source) => {
        source.stop();
        source.disconnect();
      });
      effectsGain.disconnect();
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      gain.disconnect();
      void context.close().catch(() => {});
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    if (engine.current) engine.current.gain.gain.value = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    if (engine.current)
      engine.current.effectsGain.gain.value = muted ? 0 : effectsVolume;
  }, [effectsVolume, muted]);

  const url = track?.url;
  const loop = track?.loop;
  const key = track?.key;
  useEffect(() => {
    const audio = engine.current;
    if (!audio || !url) return;
    let stopped = false;
    let source: AudioBufferSourceNode | undefined;
    let buffer = audio.buffers.get(url);
    if (!buffer) {
      buffer = (async () => {
        const response = await fetch(url, { signal: audio.signal });
        if (!response.ok) throw new Error("Audio unavailable");
        return audio.context.decodeAudioData(await response.arrayBuffer());
      })();
      audio.buffers.set(url, buffer);
    }
    void buffer
      .then((decoded) => {
        if (stopped) return;
        source = audio.context.createBufferSource();
        source.buffer = decoded;
        source.loop = loop ?? false;
        source.connect(audio.gain);
        source.start();
      })
      .catch(() => {
        // Playback failure must never interrupt room or game actions.
        audio.buffers.delete(url);
      });
    return () => {
      stopped = true;
      source?.stop();
      source?.disconnect();
    };
  }, [url, loop, key]);
}
