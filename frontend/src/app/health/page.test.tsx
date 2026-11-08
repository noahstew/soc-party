import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HealthPage from "./page";

function mockAPI(
  health: unknown,
  packs: unknown,
  healthStatus = 200,
  packsStatus = 200,
) {
  const mock = vi.fn(async (url: string) =>
    url.endsWith("/healthz")
      ? new Response(JSON.stringify(health), { status: healthStatus })
      : new Response(JSON.stringify(packs), { status: packsStatus }),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("health page", () => {
  it("fetches both endpoints and shows healthy DB and original pack", async () => {
    const fetch = mockAPI({ status: "ok", database: "ok" }, [
      { id: 1, slug: "original", title: "Small Talk, Big Nonsense" },
    ]);
    render(await HealthPage());
    expect(screen.getByText("Reachable")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Small Talk, Big Nonsense")).toBeInTheDocument();
    const status = screen.getByRole("region", { name: "Connection status" });
    const refresh = within(status).getByRole("button", {
      name: "Refresh status",
    });
    expect(refresh).toHaveAttribute("type", "submit");
    expect(refresh.closest("form")).toHaveAttribute("action", "/health");
    expect(
      screen.getByRole("region", { name: "Official starter pack" }),
    ).toHaveTextContent("Small Talk, Big Nonsense");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      fetch.mock.calls.map(([url]) => new URL(url).pathname).sort(),
    ).toEqual(["/api/packs", "/healthz"]);
  });
  it("distinguishes a reachable API from a failed DB", async () => {
    mockAPI(
      { status: "error", database: "unavailable" },
      { error: "packs unavailable" },
      503,
      503,
    );
    render(await HealthPage());
    expect(screen.getByText("Reachable")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Packs are unavailable",
    );
  });
  it("renders a useful page when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(await HealthPage());
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it("handles an empty official pack list", async () => {
    mockAPI({ status: "ok", database: "ok" }, []);
    render(await HealthPage());
    expect(screen.getByText(/No official packs yet/)).toBeInTheDocument();
  });
  it("rejects malformed payloads instead of crashing or claiming health", async () => {
    mockAPI({ database: "maybe" }, [{ title: "Missing ID" }]);
    render(await HealthPage());
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
