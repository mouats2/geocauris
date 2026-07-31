import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoCauris - crédits IA pour la cartographie",
  description: "La puissance IA pour vos workflows géospatiaux, Codex et QGIS."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
