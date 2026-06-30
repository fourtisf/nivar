import type { Metadata, Viewport } from "next";
import "../components/Game/game.css";

export const metadata: Metadata = {
  title: "NIVAR — Survive the Winter",
  description: "Crypto-winter survival GameFi on Solana. Build your base, summon CT legends, raid the bear, stack $NIVAR.",
  metadataBase: new URL("https://nivar.fun"),
  openGraph: {
    title: "NIVAR — Survive the Winter",
    description: "Crypto-winter survival GameFi on Solana. Build, summon, raid the bear, stack $NIVAR.",
    url: "https://nivar.fun",
    siteName: "NIVAR",
    images: [{ url: "/brand/nivar-hero.png", width: 1500, height: 560 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NIVAR — Survive the Winter",
    description: "Crypto-winter survival GameFi on Solana. Build, summon, raid the bear, stack $NIVAR.",
    images: ["/brand/nivar-hero.png"],
  },
};

// Mirrors the prototype's <meta name="viewport" ...> exactly.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Rajdhani:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
