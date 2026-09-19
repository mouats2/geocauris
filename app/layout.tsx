import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./dashboard.css";
import "./metrics.css";
import "./responsive.css";

export const metadata: Metadata = {
  title: "GeoCauris - crédits IA pour la cartographie",
  description: "La puissance IA pour vos workflows géospatiaux, Codex et QGIS.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
