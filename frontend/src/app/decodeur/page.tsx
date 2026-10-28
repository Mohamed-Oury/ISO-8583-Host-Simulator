"use client";

import AppShell from "@/components/AppShell";
import DynamicDecoder from "@/components/tabs/DynamicDecoder";

export default function DecodeurPage() {
  return (
    <AppShell activeTab="decoder">
      {() => <DynamicDecoder />}
    </AppShell>
  );
}
