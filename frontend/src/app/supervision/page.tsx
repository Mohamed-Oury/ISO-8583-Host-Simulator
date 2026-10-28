"use client";

import AppShell from "@/components/AppShell";
import LogsTerminal from "@/components/tabs/LogsTerminal";

export default function SupervisionPage() {
  return (
    <AppShell activeTab="logs">
      {() => <LogsTerminal />}
    </AppShell>
  );
}
