"use client";

import AppShell from "@/components/AppShell";
import ChaosIncidentLab from "@/components/tabs/ChaosIncidentLab";

export default function ChaosPage() {
  return (
    <AppShell activeTab="chaos">
      {({ reloadStatus }) => <ChaosIncidentLab onRefresh={reloadStatus} />}
    </AppShell>
  );
}
