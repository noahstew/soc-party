import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "PartiSocial — bring your friends",
  description:
    "Your home for original party games. Create a room, invite friends, and choose a game together.",
};
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#faf8f5",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
