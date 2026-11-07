import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soc Party — bring your friends",
  description:
    "Create a room, invite your friends, and gather for original party games.",
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
