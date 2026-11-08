import { RoomLobby } from "@/platform/room-lobby";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-6 py-12">
      <RoomLobby
        apiURL={process.env.API_PUBLIC_URL ?? "http://localhost:8080"}
      />
    </main>
  );
}
