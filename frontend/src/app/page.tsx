import { fetchHealth, fetchPacks } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [health, packs] = await Promise.all([fetchHealth(), fetchPacks()]);
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header>
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-300">
          Soc Party / Phase 0
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          A little groundwork.
          <br />A lot of future nonsense.
        </h1>
        <p className="mt-4 text-slate-300">
          Original party games, on everyone’s own device. The foundation is
          here; rooms and games come next.
        </p>
      </header>
      <section
        aria-labelledby="status-title"
        className="rounded-2xl border border-slate-700 bg-slate-800 p-6"
      >
        <h2 id="status-title" className="text-xl font-semibold">
          Connection status
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <dt>API</dt>
          <dd>{health ? "Reachable" : "Unavailable"}</dd>
          <dt>Database</dt>
          <dd>
            {health?.database === "ok"
              ? "Healthy"
              : health
                ? "Unavailable"
                : "Unknown"}
          </dd>
        </dl>
      </section>
      <section aria-labelledby="pack-title">
        <h2 id="pack-title" className="text-xl font-semibold">
          Official starter pack
        </h2>
        {packs === null ? (
          <p role="alert" className="mt-3 text-amber-200">
            Packs are unavailable. Try refreshing shortly.
          </p>
        ) : packs.length === 0 ? (
          <p className="mt-3 text-slate-300">
            No official packs yet. Run the starter seed.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {packs.map((pack) => (
              <li
                key={pack.id}
                className="rounded-xl border border-slate-700 p-4 text-emerald-200"
              >
                {pack.title}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-sm text-slate-400">
        Wit Parade is a working title. Gameplay is planned for a later
        milestone.
      </p>
    </main>
  );
}
