"use client";

import AppShell from "@/components/AppShell";
import UsersManagement from "@/components/tabs/UsersManagement";

export default function UtilisateursPage() {
  return (
    <AppShell activeTab="users">
      {() => <UsersManagement />}
    </AppShell>
  );
}
