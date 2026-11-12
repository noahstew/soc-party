import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Countdown } from "./countdown";

afterEach(() => vi.useRealTimers());

describe("Countdown", () => {
  it("shows seconds inside a decorative clock using the server deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    render(<Countdown deadlineMs={104_000} serverNowMs={4_000} />);

    const clock = screen.getByLabelText("100 seconds remaining");
    expect(clock).toHaveTextContent(/^100$/);
    expect(clock.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(clock).toContainElement(screen.getByText("100"));

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByLabelText("99 seconds remaining")).toHaveTextContent(
      /^99$/,
    );
    act(() => vi.advanceTimersByTime(100_000));
    expect(screen.getByLabelText("0 seconds remaining")).toHaveTextContent(
      /^0$/,
    );
  });

  it("hides the clock when there is no deadline", () => {
    const { container } = render(<Countdown serverNowMs={1_000} />);
    expect(container).toBeEmptyDOMElement();
  });
});
