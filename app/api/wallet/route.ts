import { NextResponse } from "next/server";
import { CAURIS_PACKS } from "../../../lib/pricing";

export async function GET() {
  return NextResponse.json({ uid: "demo-user", balance: 840, currency: "cauris", updatedAt: new Date().toISOString() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const credits = Number(body.credits);
  const pack = CAURIS_PACKS.find((item) => item.credits === credits);
  if (!pack) return NextResponse.json({ error: "Pack invalide" }, { status: 400 });
  return NextResponse.json({ status: "payment_pending", packId: pack.id, credits: pack.credits, amountXof: pack.priceXof, provider: "fedapay", message: "Créer une transaction FedaPay puis attendre le webhook serveur." }, { status: 202 });
}
