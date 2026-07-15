import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReRun - Appointment television for your homework",
  description: "An interactive retro-TV study experience built for OpenAI Build Week.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
