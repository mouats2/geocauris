import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestoreOnly } from "../../../../lib/firebase-firestore-admin";
import { requireUser } from "../../../../lib/admin";
import { CAURIS_PACKS } from "../../../../lib/pricing";
import { createCheckoutSession } from "../../../../lib/saspay";

export async function POST(request: Request) {
  let user: { uid: string; email: string };
  try {
    user = await requireUser(request);
  } catch {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const pack = CAURIS_PACKS.find((item) => item.id === body.packId);
  if (!pack) return NextResponse.json({ error: "Pack invalide" }, { status: 400 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://geocauris.vercel.app").replace(/\/$/, "");

  let session;
  try {
    session = await createCheckoutSession({
      amount: pack.priceXof.toFixed(2),
      currency: "XOF",
      description: `GeoCauris uid:${user.uid} pack:${pack.id}`,
      country: "BJ",
      customer_email: user.email,
      customer_name: user.email.split("@")[0] ?? "Client GeoCauris",
      return_url: `${appUrl}/?paiement=retour`,
      metadata: { uid: user.uid, packId: pack.id, credits: pack.credits },
    });
  } catch (error) {
    const message = error instanceof Error && error.message === "SASPAY_SECRET_KEY_MISSING" ? "Le paiement n'est pas configuré côté serveur" : "Impossible de créer le paiement SasPay";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const db = adminFirestoreOnly();
  await db.collection("checkoutSessions").doc(session.id).set({
    uid: user.uid,
    packId: pack.id,
    credits: pack.credits,
    priceXof: pack.priceXof,
    provider: "saspay",
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ paymentUrl: session.checkout_url });
}
