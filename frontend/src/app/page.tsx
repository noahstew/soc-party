import { RoomLobby } from "@/platform/room-lobby";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col justify-center px-4 py-8 sm:px-6 sm:py-12">
      <RoomLobby
        apiURL={process.env.API_PUBLIC_URL ?? "http://localhost:8080"}
      />
    </main>
  );
}
