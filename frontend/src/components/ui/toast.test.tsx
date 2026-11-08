import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "./toast";
import { useToast, type ToastEvent } from "@/lib/use-toast";

function Controls() {
  const { notify } = useToast();
  return (
    <>
      {(["error", "info", "warning", "success"] as ToastEvent[]).map(
        (variant) => (
          <button
            key={variant}
            onClick={() => notify(`${variant} message`, variant)}
          >
            Show {variant}
          </button>
        ),
      )}
    </>
  );
}
function setup() {
  return render(
    <ToastProvider>
      <Controls />
    </ToastProvider>,
  );
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("global toasts", () => {
  it.each(["error", "info", "warning", "success"] as const)(
    "announces %s with an explicit label and supports dismissal",
    (variant) => {
      setup();
      fireEvent.click(screen.getByRole("button", { name: `Show ${variant}` }));
      const role =
        variant === "error" || variant === "warning" ? "alert" : "status";
      expect(screen.getByRole(role)).toHaveTextContent(`${variant} message`);
      expect(
        screen.getByText(variant[0].toUpperCase() + variant.slice(1)),
      ).toBeVisible();
      fireEvent.click(
        screen.getByRole("button", { name: "Dismiss notification" }),
      );
      act(() => vi.advanceTimersByTime(250));
      expect(screen.queryByText(`${variant} message`)).not.toBeInTheDocument();
    },
  );
  it("replaces old feedback and re-announces repeated messages", () => {
    setup();
    const show = screen.getByRole("button", { name: "Show error" });
    fireEvent.click(show);
    const previous = screen.getByText("error message");
    fireEvent.click(show);
    expect(previous).not.toBeInTheDocument();
    expect(screen.getAllByText("error message")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Show success" }));
    expect(screen.queryByText("error message")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("success message");
  });
  it.each(["error", "info", "warning", "success"] as const)(
    "fades %s after three seconds and removes it after the exit animation",
    (variant) => {
      setup();
      fireEvent.click(screen.getByRole("button", { name: `Show ${variant}` }));
      act(() => vi.advanceTimersByTime(2999));
      const toast = screen
        .getByText(`${variant} message`)
        .closest('[data-slot="toast"]')!;
      expect(toast).toHaveAttribute("data-state", "open");
      act(() => vi.advanceTimersByTime(1));
      expect(toast).toHaveAttribute("data-state", "closing");
      act(() => vi.advanceTimersByTime(250));
      expect(screen.queryByText(`${variant} message`)).not.toBeInTheDocument();
    },
  );
  it("does not let an old exit timer remove a newer notification", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Show error" }));
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.click(screen.getByRole("button", { name: "Show success" }));
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByText("success message")).toBeVisible();
    act(() => vi.advanceTimersByTime(2750));
    expect(
      screen.getByText("success message").closest('[data-slot="toast"]'),
    ).toHaveAttribute("data-state", "closing");
  });
  it("pauses dismissal while hovered or focused and resumes after interaction", () => {
    vi.useFakeTimers();
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Show info" }));
    const toast = screen
      .getByText("info message")
      .closest('[data-slot="toast"]')!;
    const close = screen.getByRole("button", { name: "Dismiss notification" });
    fireEvent.mouseEnter(toast);
    act(() => close.focus());
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText("info message")).toBeVisible();
    act(() => close.blur());
    act(() => vi.advanceTimersByTime(3000));
    act(() => vi.advanceTimersByTime(250));
    expect(screen.queryByText("info message")).not.toBeInTheDocument();
  });
});
