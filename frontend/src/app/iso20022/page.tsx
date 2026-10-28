"use client";

import AppShell from "@/components/AppShell";
import Iso20022Bridge from "@/components/tabs/Iso20022Bridge";

export default function Iso20022Page() {
  return (
    <AppShell activeTab="iso20022">
      {() => <Iso20022Bridge />}
    </AppShell>
  );
}
