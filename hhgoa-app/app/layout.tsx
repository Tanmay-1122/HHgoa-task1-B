import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HH Goa 2026 — Builder ID Generator",
  description:
    "Turn your photo into an official HH Goa 2026 Builder ID card in seconds. Download it, share it, tag #FrameInGoa.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,900&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="bg-noise" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
