import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RoomLobby } from "@/platform/room-lobby";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header>
        <Badge
          variant="neutral"
          className="mb-6 -rotate-2 border-main bg-main text-main-foreground uppercase tracking-widest shadow-shadow"
        >
          Soc Party
        </Badge>
        <h1 className="text-4xl font-heading tracking-tight sm:text-5xl">
          Good company.
          <br />
          <span className="text-main">Great game nights.</span>
        </h1>
        <p className="mt-5 max-w-lg text-muted-foreground leading-relaxed">
          A home for original party games. Everyone plays on their own device.
          Create a room, invite your friends, and choose a game together.
        </p>
      </header>
      <RoomLobby
        apiURL={process.env.API_PUBLIC_URL ?? "http://localhost:8080"}
      />
      <Link
        href="/health"
        className="w-fit text-sm text-muted-foreground underline hover:text-main"
      >
        System health
      </Link>
      <p className="text-sm text-muted-foreground">
        One room for the whole group. No accounts or shared host screen needed.
      </p>
    </main>
  );
}
