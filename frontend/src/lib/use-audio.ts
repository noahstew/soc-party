"use client";

import { useEffect, useRef } from "react";

export type AudioTrack = { url: string; loop: boolean; key: string };

// One audio context and decoded-buffer cache per room visit, shared by all phases.
export function useAudio(
  track: AudioTrack | null,
  volume: number,
  muted: boolean,
) {
  const engine = useRef<{
    context: AudioContext;
    gain: GainNode;
    buffers: Map<string, Promise<AudioBuffer>>;
    signal: AbortSignal;
  } | null>(null);

  useEffect(() => {
    if (typeof AudioContext === "undefined") return;
    const context = new AudioContext();
    const gain = context.createGain();
    gain.connect(context.destination);
    const controller = new AbortController();
    engine.current = {
      context,
      gain,
      buffers: new Map(),
      signal: controller.signal,
    };
    const resume = () => {
      if (context.state === "suspended") void context.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    resume();
    return () => {
      controller.abort();
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
