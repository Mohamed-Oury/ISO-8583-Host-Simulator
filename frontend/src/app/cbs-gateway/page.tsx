"use client";

import AppShell from "@/components/AppShell";
import CbsGateway from "@/components/tabs/CbsGateway";

export default function CbsGatewayPage() {
  return (
    <AppShell activeTab="cbs">
      {() => <CbsGateway />}
    </AppShell>
  );
}
