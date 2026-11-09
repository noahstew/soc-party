import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { fetchHealth, fetchPacks } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const [health, packs] = await Promise.all([fetchHealth(), fetchPacks()]);
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header>
        <Badge variant="neutral" className="mb-4 border-main text-main-ink">
          PartiSocial
        </Badge>
        <h1 className="text-4xl font-heading">System health</h1>
        <Link href="/" className="mt-4 inline-block text-main-ink underline">
          Back to PartiSocial
        </Link>
      </header>
      <section aria-labelledby="status-title">
        <Card className="bg-secondary-background">
          <CardHeader>
            <h2 id="status-title" className="text-xl font-heading">
              Connection status
            </h2>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 items-center gap-3">
              <dt>API</dt>
              <dd>
                <Badge>{health ? "Reachable" : "Unavailable"}</Badge>
              </dd>
              <dt>Database</dt>
              <dd>
                <Badge>
                  {health?.database === "ok"
                    ? "Healthy"
                    : health
                      ? "Unavailable"
                      : "Unknown"}
                </Badge>
              </dd>
            </dl>
            <form action="/health" className="mt-6">
              <Button type="submit">Refresh status</Button>
            </form>
          </CardContent>
        </Card>
      </section>
      <section aria-labelledby="pack-title">
        <h2 id="pack-title" className="text-xl font-heading">
          Official starter pack
        </h2>
        {packs === null ? (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>
              Packs are unavailable. Try refreshing shortly.
            </AlertDescription>
          </Alert>
        ) : packs.length === 0 ? (
          <p className="mt-3">No official packs yet. Run the starter seed.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {packs.map((pack) => (
              <li key={pack.id}>
                <Card size="sm" className="bg-main text-main-foreground">
                  <CardContent>{pack.title}</CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
