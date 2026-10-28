"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import TerminalSimulator from "@/components/tabs/TerminalSimulator";

function SimulatorContent({ onRefresh }: { onRefresh: () => void }) {
  const searchParams = useSearchParams();
  const preset = searchParams.get("preset");
  return <TerminalSimulator initialPreset={preset} onRefresh={onRefresh} />;
}

export default function SimulateurPage() {
  return (
    <AppShell activeTab="simulator">
      {({ reloadStatus }) => (
        <Suspense fallback={<div className="card">Chargement du simulateur ISO 8583...</div>}>
          <SimulatorContent onRefresh={reloadStatus} />
        </Suspense>
      )}
    </AppShell>
  );
}
