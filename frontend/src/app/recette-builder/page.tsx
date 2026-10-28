"use client";

import AppShell from "@/components/AppShell";
import TestScenarioBuilder from "@/components/tabs/TestScenarioBuilder";

export default function RecetteBuilderPage() {
  return (
    <AppShell activeTab="builder">
      {() => <TestScenarioBuilder />}
    </AppShell>
  );
}
