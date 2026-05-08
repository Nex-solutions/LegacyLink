import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBuyQuote, createBuyIntent } from "@/lib/paytrie.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/funds/add")({
  head: () => ({ meta: [{ title: "Add Funds — LegacyLink" }] }),
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: AddFundsPage,
});

type Quote = { quoteId: number; rightSideValue: string; fee: number };
type Intent = {
  intentId: string;
  paytrieTxId: string;
  rmt?: string;
  destinationWallet: string;
  depositEmail: string;
  simulated: boolean;
};

function AddFundsPage() {
  const navigate = useNavigate();
  const quoteFn = useServerFn(getBuyQuote);
  const intentFn = useServerFn(createBuyIntent);
  const [amount, setAmount] = useState<number>(100);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const quoteMut = useMutation({
    mutationFn: () => quoteFn({ data: { amountCad: amount } }),
    onSuccess: (q) => setQuote({ quoteId: q.quoteId, rightSideValue: q.rightSideValue, fee: q.fee }),
  });

  const intentMut = useMutation({
    mutationFn: () => {
      if (!quote) throw new Error("Get a quote first");
      return intentFn({ data: { amountCad: amount, quoteId: quote.quoteId } });
    },
    onSuccess: (res) => setIntent(res),
  });

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Add Funds</h1>
        <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>← Dashboard</Button>
      </div>

      {!intent && (
        <Card>
          <CardHeader><CardTitle>How much CAD do you want to add?</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="amt">Amount (CAD)</Label>
              <Input
                id="amt"
                type="number"
                min={10}
                max={50000}
                value={amount}
                onChange={(e) => { setAmount(Number(e.target.value)); setQuote(null); }}
              />
            </div>
            {!quote ? (
              <Button onClick={() => quoteMut.mutate()} disabled={quoteMut.isPending || amount < 10}>
                {quoteMut.isPending ? "Getting rate…" : "Get rate"}
              </Button>
            ) : (
              <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
                <div className="flex justify-between text-sm"><span>You pay</span><span className="font-mono">CA${amount.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span>Fee</span><span className="font-mono">CA${quote.fee.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold"><span>You'll receive</span><span className="font-mono">{quote.rightSideValue} USDC</span></div>
                <Button className="w-full mt-2" onClick={() => intentMut.mutate()} disabled={intentMut.isPending}>
                  {intentMut.isPending ? "Creating…" : "Continue to payment"}
                </Button>
              </div>
            )}
            {quoteMut.error && <p className="text-sm text-destructive">{(quoteMut.error as Error).message}</p>}
            {intentMut.error && <p className="text-sm text-destructive">{(intentMut.error as Error).message}</p>}
          </CardContent>
        </Card>
      )}

      {intent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Send your Interac e-Transfer</CardTitle>
              {intent.simulated && <Badge variant="outline">Sandbox</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <Field label="Send to (email)" value={intent.depositEmail} />
              {intent.rmt && <Field label="Reference / Message" value={intent.rmt} highlight />}
              <Field label="Amount" value={`CA$${amount.toFixed(2)}`} />
            </div>

            <p className="text-sm text-muted-foreground">
              Open your bank's Interac e-Transfer page and send <strong>CA${amount.toFixed(2)}</strong> to{" "}
              <strong>{intent.depositEmail}</strong>. You <em>must</em> include the reference{" "}
              <strong>{intent.rmt}</strong> in the message field — this is how we match the payment to your account.
            </p>

            {!acknowledged ? (
              <Button className="w-full" onClick={() => setAcknowledged(true)}>I've sent the e-Transfer</Button>
            ) : (
              <div className="rounded-lg bg-primary/5 border border-primary/30 p-4 text-center">
                <p className="font-medium">Your trust is making its way to us 🛡️</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We'll receive a confirmation from Paytrie usually within 15–30 minutes. Once funds land, we sweep them into your vault automatically.
                </p>
                <Button variant="outline" className="mt-3" onClick={() => navigate({ to: "/funds/history" })}>
                  View status
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <code className={`text-sm break-all text-right ${highlight ? "font-bold text-primary" : ""}`}>{value}</code>
    </div>
  );
}
