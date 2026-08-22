import { NextResponse } from "next/server";
import { CAURIS_PACKS } from "../../../../lib/pricing";

export async function POST(request: Request) {
  const secretKey = process.env.FEDAPAY_SECRET_KEY;
  const apiBase = process.env.FEDAPAY_API_BASE_URL ?? "https://api.fedapay.com/v1";
  if (!secretKey) return NextResponse.json({ error: "FedaPay n'est pas encore configuré. Ajoutez FEDAPAY_SECRET_KEY." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const pack = CAURIS_PACKS.find((item) => item.id === body.packId);
  const email = typeof body.email === "string" ? body.email : "";
  if (!pack || !email) return NextResponse.json({ error: "Pack ou email invalide." }, { status: 400 });

  const upstream = await fetch(`${apiBase.replace(/\/$/, "")}/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      description: `GeoCauris - ${pack.credits} cauris`,
      amount: pack.priceXof,
      currency: { iso: "XOF" },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/?payment=success`,
      customer: { email },
      custom_metadata: { packId: pack.id, credits: pack.credits, uid: body.uid ?? "" },
    }),
    cache: "no-store",
  });
  const responseText = await upstream.text();
  if (!upstream.ok) return new NextResponse(responseText, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  const created = JSON.parse(responseText || "{}");
  const transaction = created.data ?? created.transaction ?? created["v1/transaction"] ?? created;
  const transactionId = findTransactionId(transaction) ?? findTransactionId(created);
  if (!transactionId) return NextResponse.json({ error: "FedaPay n'a pas retourné d'identifiant de transaction." }, { status: 502 });
  if (transaction.payment_url) return NextResponse.json({ transactionId, paymentUrl: transaction.payment_url }, { status: 201 });
  const tokenResponse = await fetch(`${apiBase.replace(/\/$/, "")}/transactions/${transactionId}/token`, { method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store" });
  const tokenText = await tokenResponse.text();
  if (!tokenResponse.ok) return new NextResponse(tokenText, { status: tokenResponse.status, headers: { "Content-Type": tokenResponse.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  const tokenPayload = JSON.parse(tokenText || "{}");
  const token = tokenPayload.token ?? tokenPayload.data?.token;
  if (!token) return NextResponse.json({ error: "FedaPay n'a pas retourné de token de paiement." }, { status: 502 });
  return NextResponse.json({ transactionId, paymentUrl: `https://checkout.fedapay.com/?token=${encodeURIComponent(token)}` }, { status: 201 });
}

function findTransactionId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.id !== undefined && (typeof record.id === "string" || typeof record.id === "number")) return String(record.id);
  if (record.transaction_id !== undefined) return String(record.transaction_id);
  for (const child of Object.values(record)) {
    const found = findTransactionId(child);
    if (found) return found;
  }
  return null;
}
