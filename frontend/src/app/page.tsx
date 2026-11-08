import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RoomLobby } from "@/platform/room-lobby";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header>
        <Badge variant="neutral" className="mb-4 uppercase tracking-widest">
          Soc Party / Zinger
        </Badge>
        <h1 className="text-4xl font-heading tracking-tight sm:text-5xl">
          Good company.
          <br />
          Questionable answers.
        </h1>
        <p className="mt-4">
          Original party games, on everyone’s own device. Bring your friends;
          we’ll keep a place for everyone.
        </p>
      </header>
      <RoomLobby
        apiURL={process.env.API_PUBLIC_URL ?? "http://localhost:8080"}
      />
      <Link href="/health" className="text-sm underline">
        System health
      </Link>
      <p className="text-sm">
        Zinger is a working title. Gameplay is planned for a later milestone.
      </p>
    </main>
  );
}
