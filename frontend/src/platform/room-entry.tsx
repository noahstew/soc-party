"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/lib/use-toast";

type RoomEntryProps = {
  name: string;
  code: string;
  busy: boolean;
  onNameChange: (name: string) => void;
  onCodeChange: (code: string) => void;
  onEnter: (action: "create" | "join") => void;
};

function Brand() {
  return (
    <Badge className="mx-auto -rotate-2 border-main bg-main px-5 py-2 text-2xl font-heading tracking-widest text-main-foreground shadow-shadow sm:text-3xl">
      SOC PARTY
    </Badge>
  );
}

const inputStyle =
  "mt-3 w-full rounded-base border-2 border-border bg-input-background px-4 py-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-background disabled:cursor-not-allowed disabled:opacity-60";

export function RoomEntry({
  name,
  code,
  busy,
  onNameChange,
  onCodeChange,
  onEnter,
}: RoomEntryProps) {
  const [flipped, setFlipped] = useState(false);
  const flipper = useRef<HTMLDivElement>(null);
  const frontFace = useRef<HTMLDivElement>(null);
  const backFace = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const { notify, dismiss } = useToast();

  useLayoutEffect(() => {
    const face = flipped ? backFace.current : frontFace.current;
    const container = flipper.current;
    if (!face || !container) return;
    const resize = () => {
      container.style.height = `${face.offsetHeight}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(face);
    return () => observer.disconnect();
  }, [flipped]);

  function continueToRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim() || Array.from(name.trim()).length > 24) {
      notify("Enter a name with 1–24 characters.", "error");
      nameInput.current?.focus();
      return;
    }
    dismiss();
    setFlipped(true);
    // Wait for React to remove inert from the next face before moving focus.
    requestAnimationFrame(() => codeInput.current?.focus());
  }

  return (
    <section aria-label="Room admission" className="room-entry">
      <div ref={flipper} className="room-entry-flipper" data-flipped={flipped}>
        <Card
          ref={frontFace}
          className="room-entry-face gap-10 px-6 py-10 sm:px-10"
          inert={flipped}
          aria-hidden={flipped}
        >
          <h1 className="text-center">
            <Brand />
          </h1>
          <form
            noValidate
            onSubmit={continueToRoom}
            aria-busy={busy}
            className="space-y-6"
          >
            <div>
              <label htmlFor="player-name" className="font-heading">
                Player Name
              </label>
              <input
                ref={nameInput}
                id="player-name"
                autoComplete="nickname"
                maxLength={48}
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                disabled={busy}
                className={inputStyle}
                placeholder="What other players will see you as"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="group h-12 w-full text-base"
            >
              Continue
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
              >
                <path
                  d="M4 12h16m-6-6 6 6-6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
          </form>
        </Card>
        <Card
          ref={backFace}
          className="room-entry-face room-entry-back gap-8 px-6 pt-4 pb-10 sm:px-10"
          inert={!flipped}
          aria-hidden={!flipped}
        >
          <div className="flex flex-col gap-5">
            <Button
              type="button"
              variant="noShadow"
              size="sm"
              disabled={busy}
              className="-ml-2 h-11 w-fit border-transparent bg-transparent px-2 text-muted-foreground hover:bg-input-background hover:text-foreground"
              onClick={() => {
                setFlipped(false);
                requestAnimationFrame(() => nameInput.current?.focus());
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="m14 6-6 6 6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back
            </Button>
            <Brand />
          </div>
          <form
            noValidate
            aria-busy={busy}
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              onEnter("join");
            }}
          >
            <div>
              <label htmlFor="room-code" className="font-heading">
                Room Code
              </label>
              <input
                ref={codeInput}
                id="room-code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={6}
                value={code}
                onChange={(event) =>
                  onCodeChange(event.target.value.toUpperCase())
                }
                disabled={busy}
                className={`${inputStyle} font-mono uppercase tracking-widest`}
                placeholder="ABCDEF"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full text-base"
            >
              {busy ? "One moment…" : "Connect"}
            </Button>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>No room code?</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="neutral"
              disabled={busy}
              onClick={() => onEnter("create")}
              className="h-12 w-full border-main text-base text-main"
            >
              Create Room
            </Button>
          </form>
        </Card>
      </div>
    </section>
  );
}
