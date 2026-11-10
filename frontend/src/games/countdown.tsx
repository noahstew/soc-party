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
  useEffect(() => {
    if (!deadlineMs) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadlineMs]);
  if (!deadlineMs) return null;
  const serverOffset = serverNowMs - now;
  const seconds = Math.max(
    0,
    Math.ceil((deadlineMs - (now + serverOffset)) / 1000),
  );
  return (
    <span
      aria-label={`${seconds} seconds remaining`}
      className="font-heading tabular-nums"
    >
      {seconds}s
    </span>
  );
}
