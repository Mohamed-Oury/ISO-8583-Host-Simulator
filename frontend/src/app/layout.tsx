import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ISO 8583 Host Simulator & Banc d'Essai d'Homologation",
  description:
    "Plateforme de qualification et banc d'essai pour Serveur d'Autorisation Émetteur ISO 8583. Cadrage TCP 2-octets Big-Endian, matrice d'arbitrage 10 règles, 50 cartes de test et injection de charge 100 TPS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="dark-theme">{children}</body>
    </html>
  );
}
