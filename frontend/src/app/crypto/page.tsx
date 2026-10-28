"use client";

import AppShell from "@/components/AppShell";
import HsmCryptoStudio from "@/components/tabs/HsmCryptoStudio";

export default function CryptoPage() {
  return (
    <AppShell activeTab="crypto">
      {() => <HsmCryptoStudio />}
    </AppShell>
  );
}
