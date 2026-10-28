"use client";

import AppShell from "@/components/AppShell";
import NetworkProfiles from "@/components/tabs/NetworkProfiles";

export default function NetworkProfilesPage() {
  return (
    <AppShell activeTab="profiles">
      {() => <NetworkProfiles />}
    </AppShell>
  );
}
