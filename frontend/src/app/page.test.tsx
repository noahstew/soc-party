import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

describe("home", () => {
  it("shows room admission and links to health without diagnostic fetches", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<Home />);
    expect(
      screen.getByRole("button", { name: "Create a room" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Join a room" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "System health" })).toHaveAttribute(
      "href",
      "/health",
    );
    expect(
      screen.queryByRole("region", { name: "Connection status" }),
    ).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
