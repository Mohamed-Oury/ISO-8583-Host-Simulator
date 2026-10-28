"use client";

import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import HomologationSuite from "@/components/tabs/HomologationSuite";

export default function HomePage() {
  const router = useRouter();

  return (
    <AppShell activeTab="suite">
      {({ reloadStatus }) => (
        <HomologationSuite
          onSelectTestCase={(tcId) => router.push(`/simulateur?preset=${encodeURIComponent(tcId)}`)}
          onRefresh={reloadStatus}
        />
      )}
    </AppShell>
  );
}
