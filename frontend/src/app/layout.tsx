import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soc Party — bring your friends",
  description:
    "Your home for original party games. Create a room, invite friends, and choose a game together.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
