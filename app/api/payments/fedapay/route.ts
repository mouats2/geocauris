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
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/webhooks/fedapay`,
      customer: { email },
      metadata: { packId: pack.id, credits: pack.credits, uid: body.uid ?? "" },
    }),
    cache: "no-store",
  });
  const responseText = await upstream.text();
  return new NextResponse(responseText, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
}
