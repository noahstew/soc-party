import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soc Party — bring your friends",
  description:
    "Your home for original party games. Create a room, invite friends, and choose a game together.",
};
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#14141a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
