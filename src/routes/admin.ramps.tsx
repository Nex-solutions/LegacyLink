import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminListRampIntents } from "@/lib/paytrie.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/ramps")({
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: AdminRampsPage,
});

function AdminRampsPage() {
  const navigate = useNavigate();
  const fn = useServerFn(adminListRampIntents);
  const q = useQuery({ queryKey: ["admin-ramps"], queryFn: () => fn({}), refetchInterval: 15000, retry: false });

  if (q.error?.message?.includes("Admin")) {
    return <div className="p-8"><Card><CardContent className="p-6">Admin only.</CardContent></Card></div>;
  }

  const intents = q.data?.intents ?? [];
  const gas = q.data?.masterGas;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ramps & Sweeps</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/admin/ledger" })}>Ledger</Button>
          <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>← Dashboard</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Master gas (SOL)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-mono">{gas ? gas.sol.toFixed(4) : "—"}</p>
            {gas && gas.sol < 0.5 && <p className="text-xs text-destructive mt-1">Low — top up master wallet</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Paytrie mode</CardTitle></CardHeader>
          <CardContent>
            <Badge variant={q.data?.paytrieLive ? "default" : "outline"}>
              {q.data?.paytrieLive ? "Live API" : "Sandbox / mock"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total intents</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-mono">{intents.length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent ramp intents</CardTitle></CardHeader>
        <CardContent>
          {q.isLoading ? <p>Loading…</p> : intents.length === 0 ? <p className="text-muted-foreground">None.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Kind</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-right">CAD</th>
                    <th className="py-2 pr-3 text-right">USDC</th>
                    <th className="py-2 pr-3">Paytrie tx</th>
                    <th className="py-2 pr-3">Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {intents.map((i) => (
                    <tr key={i.id} className="border-b">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(i.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-3"><Badge variant="outline">{i.kind}</Badge></td>
                      <td className="py-2 pr-3 font-mono text-xs truncate max-w-[100px]">{i.user_id?.slice(0, 8)}</td>
                      <td className="py-2 pr-3"><Badge>{i.status}</Badge></td>
                      <td className="py-2 pr-3 text-right font-mono">{i.amount_cad ? Number(i.amount_cad).toFixed(2) : "—"}</td>
                      <td className="py-2 pr-3 text-right font-mono">{i.amount_usdc ? Number(i.amount_usdc).toFixed(2) : "—"}</td>
                      <td className="py-2 pr-3 font-mono text-xs truncate max-w-[120px]">{i.paytrie_tx_id}</td>
                      <td className="py-2 pr-3 font-mono text-xs truncate max-w-[120px]">{i.sweep_tx_signature ?? i.payout_tx_signature ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
