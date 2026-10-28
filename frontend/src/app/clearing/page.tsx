"use client";

import AppShell from "@/components/AppShell";
import ClearingSettlement from "@/components/tabs/ClearingSettlement";

export default function ClearingPage() {
  return (
    <AppShell activeTab="clearing">
      {() => <ClearingSettlement />}
    </AppShell>
  );
}
