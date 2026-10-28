"use client";

import AppShell from "@/components/AppShell";
import PacketReplay from "@/components/tabs/PacketReplay";

export default function RejeuPage() {
  return (
    <AppShell activeTab="replay">
      {() => <PacketReplay />}
    </AppShell>
  );
}
