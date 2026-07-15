import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReRun - Appointment television for your homework",
  description: "An interactive retro-TV study experience built for OpenAI Build Week.",
};

// Be explicit here instead of relying on the framework default. Safari can otherwise
// retain a desktop layout viewport after a rotation or restored tab session.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
