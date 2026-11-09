"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";

import { ToastContext, type ToastEvent } from "@/lib/use-toast";

type Notice = {
  id: number;
  event: ToastEvent;
  message: string;
  closing: boolean;
};
const labels: Record<ToastEvent, string> = {
  error: "Error",
  info: "Info",
  warning: "Warning",
  success: "Success",
};
const symbols: Record<ToastEvent, string> = {
  error: "!",
  info: "i",
  warning: "!",
  success: "✓",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const sequence = useRef(0);
  const notify = useCallback((message: string, event: ToastEvent) => {
    setHovered(false);
    setFocused(false);
    setNotice({ id: ++sequence.current, event, message, closing: false });
  }, []);
  const dismiss = useCallback(() => {
    setNotice((current) => (current ? { ...current, closing: true } : null));
  }, []);

  useEffect(() => {
    if (!notice) return;
    if (notice.closing) {
      const timer = setTimeout(() => setNotice(null), 250);
      return () => clearTimeout(timer);
    }
    if (hovered || focused) return;
    const timer = setTimeout(dismiss, 3000);
    return () => clearTimeout(timer);
  }, [notice, hovered, focused, dismiss]);

  const urgent = notice?.event === "error" || notice?.event === "warning";
  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed right-0 bottom-0 z-50 w-full max-w-lg px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <div
          key={notice?.id}
          style={notice ? undefined : { display: "none" }}
          data-state={notice?.closing ? "closing" : "open"}
          data-slot="toast"
          data-event={notice?.event}
          className="pointer-events-auto flex max-h-[50dvh] items-start gap-3 overflow-y-auto rounded-base border-2 border-[var(--toast-ink)] bg-secondary-background p-4 text-foreground shadow-shadow"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setFocused(false);
          }}
        >
          {notice && (
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-base border-2 border-[var(--toast-ink)] bg-[var(--toast-accent)] font-heading text-main-foreground"
            >
              {symbols[notice.event]}
            </span>
          )}
          <div className="min-w-0 flex-1 break-words">
            <div role="alert" aria-atomic="true">
              {notice && urgent && (
                <ToastMessage key={notice.id} notice={notice} />
              )}
            </div>
            <div role="status" aria-atomic="true">
              {notice && !urgent && (
                <ToastMessage key={notice.id} notice={notice} />
              )}
            </div>
          </div>
          {notice && (
            <Button
              variant="noShadow"
              size="icon-sm"
              aria-label="Dismiss notification"
              onClick={dismiss}
              className="shrink-0 border-[var(--toast-ink)] bg-[var(--toast-accent)]"
            >
              <span aria-hidden="true">×</span>
            </Button>
          )}
        </div>
      </section>
    </ToastContext.Provider>
  );
}

function ToastMessage({ notice }: { notice: Notice }) {
  return (
    <>
      <p className="font-heading text-[var(--toast-ink)]">
        {labels[notice.event]}
      </p>
      <p className="mt-1 text-sm leading-relaxed">{notice.message}</p>
    </>
  );
}
