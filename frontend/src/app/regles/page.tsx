"use client";

import AppShell from "@/components/AppShell";
import RulesMatrix from "@/components/tabs/RulesMatrix";

export default function ReglesPage() {
  return (
    <AppShell activeTab="rules">
      {() => <RulesMatrix />}
    </AppShell>
  );
}
