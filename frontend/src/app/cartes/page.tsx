"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { BankAccount, fetchAccounts } from "@/lib/api";
import AccountsExplorer from "@/components/tabs/AccountsExplorer";
import EditAccountModal from "@/components/modals/EditAccountModal";

export default function CartesPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const loadAccounts = async () => {
    try {
      const data = await fetchAccounts();
      setAccounts(data.accounts);
    } catch (err) {
      console.error("Erreur de chargement des comptes MySQL :", err);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  return (
    <AppShell activeTab="accounts">
      {({ reloadStatus }) => (
        <>
          <AccountsExplorer
            accounts={accounts}
            onRefresh={async () => {
              await loadAccounts();
              await reloadStatus();
            }}
            onEditAccount={(acc) => setEditingAccount(acc)}
          />
          <EditAccountModal
            account={editingAccount}
            onClose={() => setEditingAccount(null)}
            onSaved={async () => {
              await loadAccounts();
              await reloadStatus();
            }}
          />
        </>
      )}
    </AppShell>
  );
}
