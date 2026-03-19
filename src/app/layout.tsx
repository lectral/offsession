import type { Metadata } from "next";
import "rpg-awesome/css/rpg-awesome.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Offsession",
  description: "Create and play non-linear text RPG adventures with permanent choices and resource management in Offsession.",
  keywords: ["RPG", "text adventure", "game engine", "paragraph game", "dungeon master"],
  authors: [{ name: "Offsession" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Load pixel fonts via Google Fonts CDN */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Silkscreen:wght@400;700&display=swap" 
          rel="stylesheet" 
        />
        <style>{`
          :root {
            --font-geist-sans: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
            --font-geist-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            --font-press-start: 'Press Start 2P', monospace;
            --font-vt323: 'VT323', monospace;
            --font-silkscreen: 'Silkscreen', monospace;
          }
        `}</style>
      </head>
      <body
        className="antialiased bg-background text-foreground"
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
