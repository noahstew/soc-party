import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

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

describe("foundation page", () => {
  it("fetches both endpoints and shows healthy DB and original pack", async () => {
    const fetch = mockAPI({ status: "ok", database: "ok" }, [
      { id: 1, slug: "original", title: "Small Talk, Big Nonsense" },
    ]);
    render(await Home());
    expect(screen.getByText("Reachable")).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Small Talk, Big Nonsense")).toBeInTheDocument();
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
    render(await Home());
    expect(screen.getByText("Reachable")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Packs are unavailable",
    );
  });
  it("renders a useful page when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(await Home());
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it("handles an empty official pack list", async () => {
    mockAPI({ status: "ok", database: "ok" }, []);
    render(await Home());
    expect(screen.getByText(/No official packs yet/)).toBeInTheDocument();
  });
  it("rejects malformed payloads instead of crashing or claiming health", async () => {
    mockAPI({ database: "maybe" }, [{ title: "Missing ID" }]);
    render(await Home());
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
