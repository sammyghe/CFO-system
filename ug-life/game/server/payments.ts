// Real money in: players top up game shillings with mobile money (MTN, Airtel)
// through Flutterwave's hosted checkout. One way only: no cash-out, no betting.
// Off until FLW_SECRET_KEY is set on the server.

export interface PaymentProvider {
  /** Returns the checkout page to send the player to. */
  create(o: { ref: string; amount: number; playerId: string; name: string; redirect: string }): Promise<string | null>;
  /** True only when the provider confirms this exact payment succeeded. */
  verify(ref: string, amount: number): Promise<boolean>;
}

export class Flutterwave implements PaymentProvider {
  constructor(private secret: string) {}

  async create(o: { ref: string; amount: number; playerId: string; name: string; redirect: string }) {
    const res = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { authorization: `Bearer ${this.secret}`, "content-type": "application/json" },
      body: JSON.stringify({
        tx_ref: o.ref,
        amount: o.amount,
        currency: "UGX",
        redirect_url: o.redirect,
        payment_options: "mobilemoneyuganda",
        customer: { email: `${o.playerId}@players.ug-life.app`, name: o.name || "Ug Life player" },
        customizations: { title: "Ug Life top-up", description: "Game shillings for Ug Life (no cash-out)" },
      }),
    });
    const data = (await res.json().catch(() => null)) as { status?: string; data?: { link?: string } } | null;
    return data?.status === "success" && data.data?.link ? data.data.link : null;
  }

  async verify(ref: string, amount: number) {
    const res = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(ref)}`, {
      headers: { authorization: `Bearer ${this.secret}` },
    });
    const data = (await res.json().catch(() => null)) as { data?: { status?: string; amount?: number; currency?: string; tx_ref?: string } } | null;
    const d = data?.data;
    return !!d && d.status === "successful" && d.tx_ref === ref && d.currency === "UGX" && Number(d.amount) >= amount;
  }
}
