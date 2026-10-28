"use client";

import AppShell from "@/components/AppShell";
import LoadTestLab from "@/components/tabs/LoadTestLab";

export default function ChargePage() {
  return (
    <AppShell activeTab="loadtest">
      {({ reloadStatus }) => <LoadTestLab onRefresh={reloadStatus} />}
    </AppShell>
  );
}
