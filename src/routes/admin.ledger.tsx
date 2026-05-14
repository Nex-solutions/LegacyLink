import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMasterWallet,
  createMasterWallet,
  revealMasterWalletMnemonic,
  listLedger,
  getLedgerBalances,
} from "@/lib/ledger.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/ledger")({
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AdminLedgerPage,
});

function AdminLedgerPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchWallet = useServerFn(fetchMasterWallet);
  const createWallet = useServerFn(createMasterWallet);
  const revealMnemonic = useServerFn(revealMasterWalletMnemonic);
  const fetchLedger = useServerFn(listLedger);
  const fetchBalances = useServerFn(getLedgerBalances);

  const walletQ = useQuery({
    queryKey: ["master-wallet"],
    queryFn: () => fetchWallet({}),
    retry: false,
  });
  const balancesQ = useQuery({
    queryKey: ["ledger-balances"],
    queryFn: () => fetchBalances({}),
    retry: false,
  });
  const ledgerQ = useQuery({
    queryKey: ["ledger"],
    queryFn: () => fetchLedger({ data: { limit: 100 } }),
    retry: false,
  });

  const [revealed, setRevealed] = useState<{ pubkey: string; mnemonic: string } | null>(null);

  const initMut = useMutation({
    mutationFn: () => createWallet({}),
    onSuccess: (res) => {
      setRevealed(res);
      qc.invalidateQueries({ queryKey: ["master-wallet"] });
    },
  });

  const revealMut = useMutation({
    mutationFn: () => revealMnemonic({}),
    onSuccess: (res) => setRevealed(res),
  });

  const isAdminError = walletQ.error?.message?.includes("Admin role required");

  if (isAdminError) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Admin only</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You need the admin role to view the accounting ledger.
            </p>
            <Button className="mt-4" onClick={() => navigate({ to: "/dashboard" })}>
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const accounts = balancesQ.data?.accounts ?? [];
  const txs = ledgerQ.data?.transactions ?? [];
  const entries = ledgerQ.data?.entries ?? [];
  const acctMap = new Map((ledgerQ.data?.accounts ?? []).map((a) => [a.id, a]));

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Accounting Ledger</h1>
        <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
          ← Dashboard
        </Button>
      </div>

      {/* Master Wallet */}
      <Card>
        <CardHeader>
          <CardTitle>Master Hot Wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {walletQ.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : walletQ.data ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <code className="text-sm break-all">{walletQ.data.pubkey}</code>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => revealMut.mutate()}
                disabled={revealMut.isPending}
              >
                {revealMut.isPending ? "Decrypting…" : "Reveal seed phrase"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                No master wallet yet. Generate one to start sweeping on-ramped USDC.
              </p>
              <Button onClick={() => initMut.mutate()} disabled={initMut.isPending}>
                {initMut.isPending ? "Generating…" : "Generate master wallet"}
              </Button>
            </>
          )}

          {revealed && (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
              <p className="font-semibold text-destructive">
                Save this seed phrase offline. It will not be shown again in plain UI after refresh.
              </p>
              <p className="text-xs text-muted-foreground">
                Address: <code>{revealed.pubkey}</code>
              </p>
              <code className="block text-sm bg-background p-3 rounded select-all break-words">
                {revealed.mnemonic}
              </code>
              <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
                Hide
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Balances */}
      <Card>
        <CardHeader>
          <CardTitle>Account Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {balancesQ.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-4">Code</th>
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4 text-right">Balance</th>
                    <th className="py-2 pr-4">Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b">
                      <td className="py-2 pr-4 font-mono text-xs">{a.code}</td>
                      <td className="py-2 pr-4">{a.name}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline">{a.type}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono">{a.balance.toFixed(6)}</td>
                      <td className="py-2 pr-4">{a.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {ledgerQ.isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : txs.length === 0 ? (
            <p className="text-muted-foreground">No ledger activity yet.</p>
          ) : (
            <div className="space-y-3">
              {txs.map((tx) => {
                const txEntries = entries.filter((e) => e.transaction_id === tx.id);
                return (
                  <div key={tx.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge>{tx.kind}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()}
                        </span>
                      </div>
                      {tx.tx_signature && (
                        <code className="text-xs text-muted-foreground truncate max-w-xs">
                          {tx.tx_signature}
                        </code>
                      )}
                    </div>
                    {tx.memo && <p className="text-sm mb-2">{tx.memo}</p>}
                    <table className="w-full text-xs">
                      <tbody>
                        {txEntries.map((e) => {
                          const acct = acctMap.get(e.account_id);
                          return (
                            <tr key={e.id}>
                              <td className="py-1 pr-2 text-muted-foreground">
                                {acct?.code} · {acct?.name}
                              </td>
                              <td className="py-1 pr-2 text-right font-mono">
                                {e.side === "debit" ? Number(e.amount).toFixed(6) : ""}
                              </td>
                              <td className="py-1 pr-2 text-right font-mono">
                                {e.side === "credit" ? Number(e.amount).toFixed(6) : ""}
                              </td>
                              <td className="py-1 pl-2">{e.currency}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="text-muted-foreground border-t">
                        <tr>
                          <td className="py-1 pr-2 text-right">Totals</td>
                          <td className="py-1 pr-2 text-right font-mono">
                            {txEntries
                              .filter((e) => e.side === "debit")
                              .reduce((s, e) => s + Number(e.amount), 0)
                              .toFixed(6)}
                          </td>
                          <td className="py-1 pr-2 text-right font-mono">
                            {txEntries
                              .filter((e) => e.side === "credit")
                              .reduce((s, e) => s + Number(e.amount), 0)
                              .toFixed(6)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
