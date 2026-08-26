import { NextResponse } from "next/server";
import { adminFirestoreOnly } from "../../../lib/firebase-firestore-admin";
import { requireUser } from "../../../lib/admin";
import { CAURIS_PACKS } from "../../../lib/pricing";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const snapshot = await adminFirestoreOnly().collection("wallets").doc(user.uid).get();
    const data = snapshot.data() ?? {};
    return NextResponse.json({ uid: user.uid, balance: Number(data.soldeCauris ?? 0), currency: "cauris", updatedAt: data.updatedAt ?? null });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return NextResponse.json({ error: unauthorized ? "Authentification requise" : "Wallet indisponible" }, { status: unauthorized ? 401 : 503 });
  }
}

export async function POST(request: Request) {
  try { await requireUser(request); } catch { return NextResponse.json({ error: "Authentification requise" }, { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  const credits = Number(body.credits);
  const pack = CAURIS_PACKS.find((item) => item.credits === credits);
  if (!pack) return NextResponse.json({ error: "Pack invalide" }, { status: 400 });
  return NextResponse.json({ status: "payment_pending", packId: pack.id, credits: pack.credits, amountXof: pack.priceXof, provider: "fedapay", message: "Créer une transaction FedaPay puis attendre le webhook serveur." }, { status: 202 });
}
