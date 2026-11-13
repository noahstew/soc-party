import { ToastProvider } from "@/components/ui/toast";
import type { ReactNode } from "react";
import { render as rtlRender, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

describe("home", () => {
  it("shows only the branded player-name card without diagnostic fetches", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<Home />);
    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Player Name" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Room Code" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create Room" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      "PartiSocial",
    );
    expect(screen.getByRole("img", { name: "PartiSocial" })).toHaveAttribute(
      "width",
      "1024",
    );
    expect(screen.queryByText(/Great game nights/)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

function render(ui: ReactNode) {
  return rtlRender(<ToastProvider>{ui}</ToastProvider>);
}
