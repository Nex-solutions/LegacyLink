import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listMyRampIntents } from "@/lib/paytrie.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/funds/history")({
  head: () => ({ meta: [{ title: "Funding history — LegacyLink" }] }),
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: HistoryPage,
});

function HistoryPage() {
  const navigate = useNavigate();
  const fn = useServerFn(listMyRampIntents);
  const q = useQuery({ queryKey: ["my-ramps"], queryFn: () => fn({}), refetchInterval: 15000 });

  const intents = q.data?.intents ?? [];

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Funding history</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>← Dashboard</Button>
          <Button onClick={() => navigate({ to: "/funds/add" })}>Add funds</Button>
        </div>
      </div>

      {q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : intents.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No funding activity yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {intents.map((i) => (
            <Card key={i.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {i.kind === "onramp" ? `Add CA$${Number(i.amount_cad).toFixed(2)}` : `Payout CA$${Number(i.amount_cad ?? 0).toFixed(2)}`}
                  </CardTitle>
                  <Badge variant={i.status?.includes("complete") ? "default" : "outline"}>{i.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1 text-muted-foreground">
                <div>Created {new Date(i.created_at).toLocaleString()}</div>
                {i.paytrie_rmt && <div>Reference: <code>{i.paytrie_rmt}</code></div>}
                {i.amount_usdc && <div>{Number(i.amount_usdc).toFixed(2)} USDC</div>}
                {i.sweep_tx_signature && (
                  <div className="break-all">
                    Sweep tx:{" "}
                    <a
                      href={`https://solscan.io/tx/${i.sweep_tx_signature}?cluster=devnet`}
                      target="_blank" rel="noreferrer"
                      className="underline font-mono text-xs"
                    >
                      {i.sweep_tx_signature} ↗
                    </a>
                    <span className="ml-2 text-xs opacity-70">on Solana devnet</span>
                  </div>
                )}
                {i.payout_tx_signature && (
                  <div className="break-all">
                    Payout tx:{" "}
                    <a
                      href={`https://solscan.io/tx/${i.payout_tx_signature}?cluster=devnet`}
                      target="_blank" rel="noreferrer"
                      className="underline font-mono text-xs"
                    >
                      {i.payout_tx_signature} ↗
                    </a>
                    <span className="ml-2 text-xs opacity-70">on Solana devnet</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
