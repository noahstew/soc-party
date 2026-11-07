export type Health = { status: "ok" | "error"; database: "ok" | "unavailable" };
export type Pack = { id: number; slug: string; title: string };

// Called on the Next server only. Docker DNS never reaches the browser.
const baseURL = () => process.env.API_INTERNAL_URL ?? "http://localhost:8080";

export async function fetchHealth(): Promise<Health | null> {
  try {
    const response = await fetch(`${baseURL()}/healthz`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    // A 503 still carries useful DB health information.
    if (!response.ok && response.status !== 503) return null;
    const data: unknown = await response.json();
    if (
      typeof data !== "object" ||
      data === null ||
      !("status" in data) ||
      !("database" in data)
    )
      return null;
    if (
      (data.status !== "ok" && data.status !== "error") ||
      (data.database !== "ok" && data.database !== "unavailable")
    )
      return null;
    return { status: data.status, database: data.database };
  } catch {
    return null;
  }
}

export async function fetchPacks(): Promise<Pack[] | null> {
  try {
    const response = await fetch(`${baseURL()}/api/packs`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (
      !Array.isArray(data) ||
      !data.every(
        (p: unknown): p is Pack =>
          typeof p === "object" &&
          p !== null &&
          "id" in p &&
          typeof p.id === "number" &&
          "slug" in p &&
          typeof p.slug === "string" &&
          "title" in p &&
          typeof p.title === "string",
      )
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
