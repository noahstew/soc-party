import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soc Party — foundation",
  description: "The foundation for original multiplayer party games.",
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
