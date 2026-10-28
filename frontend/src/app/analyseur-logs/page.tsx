"use client";

import AppShell from "@/components/AppShell";
import LogAnalyzer from "@/components/tabs/LogAnalyzer";

export default function LogAnalyzerPage() {
  return (
    <AppShell activeTab="logs_analyzer">
      {() => <LogAnalyzer />}
    </AppShell>
  );
}
