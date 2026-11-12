"use client";

import { useEffect, useState } from "react";

export function Countdown({
  deadlineMs,
  serverNowMs,
}: {
  deadlineMs?: number;
  serverNowMs: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [serverOffset] = useState(() => serverNowMs - Date.now());
  useEffect(() => {
    if (!deadlineMs) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadlineMs]);
  if (!deadlineMs) return null;
  const seconds = Math.max(
    0,
    Math.ceil((deadlineMs - (now + serverOffset)) / 1000),
  );
  return (
    <span
      aria-label={`${seconds} seconds remaining`}
      className="relative inline-flex size-20 shrink-0 items-center justify-center font-heading tabular-nums"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 80 80"
        className="absolute inset-0 size-full"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M34 4h12M40 4v10M62 19l5-5" />
        <circle cx="40" cy="44" r="30" className="fill-secondary-background" />
        <path d="M40 19v4M40 65v4M15 44h4M61 44h4" />
      </svg>
      <span className="relative mt-2 text-2xl">{seconds}</span>
    </span>
  );
}
