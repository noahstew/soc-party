import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ChoiceGrid({
  label,
  children,
  tileSize = "default",
}: {
  label: string;
  children: ReactNode;
  tileSize?: "default" | "lg";
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="max-h-64 overflow-y-auto overscroll-contain rounded-base p-2 [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 sm:max-h-80"
    >
      <div className="grid grid-cols-2 gap-3">
        {children}
        <Button
          variant="neutral"
          disabled
          className={`${tileSize === "lg" ? "h-28" : "h-24"} min-w-0 px-3 text-lg whitespace-normal [overflow-wrap:anywhere]`}
        >
          Coming Soon
        </Button>
      </div>
    </div>
  );
}
