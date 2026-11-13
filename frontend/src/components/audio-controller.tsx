"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAudio, type AudioTrack } from "@/lib/use-audio";

export function AudioController({ track }: { track: AudioTrack | null }) {
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useAudio(track, volume, muted);

  return (
    <div
      className="fixed top-4 right-4 z-40"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <Button
        ref={trigger}
        variant="neutral"
        size="icon"
        aria-label="Audio settings"
        aria-expanded={open}
        aria-controls="audio-settings"
        onClick={() => setOpen(!open)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m9 3-.7 3-2 .9-2.7-.8-2 3.4L3.8 12l-2.2 2.5 2 3.4 2.7-.8 2 .9.7 3h4l.7-3 2-.9 2.7.8 2-3.4L18.2 12l2.2-2.5-2-3.4-2.7.8-2-.9L13 3Z" />
          <circle cx="11" cy="12" r="3" />
        </svg>
      </Button>
      {open && (
        <div
          id="audio-settings"
          role="group"
          aria-label="Audio controls"
          className="absolute top-full right-0 mt-2 flex items-center gap-3 rounded-base border-2 border-border bg-secondary-background p-3 shadow-shadow"
        >
          <Button
            variant="neutral"
            size="icon"
            aria-label={muted ? "Unmute audio" : "Mute audio"}
            aria-pressed={muted}
            onClick={() => setMuted(!muted)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 5 6 9H3v6h3l5 4Z" />
              {muted ? (
                <path d="m16 9 6 6m0-6-6 6" />
              ) : (
                <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
              )}
            </svg>
          </Button>
          <input
            aria-label="Audio volume"
            type="range"
            min="0"
            max="100"
            value={volume * 100}
            className="w-28 accent-main"
            onChange={(event) => setVolume(Number(event.target.value) / 100)}
          />
        </div>
      )}
    </div>
  );
}
