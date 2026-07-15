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
    <html lang="en" suppressHydrationWarning>
      <body>{children}<svg width="0" height="0" aria-hidden="true" focusable="false">
        <filter id="rerun-posterize" colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues="0 .27 .55 .8 1" />
            <feFuncG type="discrete" tableValues="0 .3 .58 .82 1" />
            <feFuncB type="discrete" tableValues="0 .34 .62 .84 1" />
          </feComponentTransfer>
        </filter>
      </svg></body>
    </html>
  );
}
