import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestoreOnly } from "../../../../lib/firebase-firestore-admin";
import { CAURIS_PACKS } from "../../../../lib/pricing";
import { listPaidCheckoutSessions, verifySaspaySignature, type SaspayCheckoutSession, type SaspayWebhookEvent } from "../../../../lib/saspay";

// Trouve, parmi les sessions de checkout SasPay marquées PAID, celle qui a
// produit cette transaction précise. SasPay ne renvoie pas l'id de session
// dans l'event webhook, seulement l'id de la transaction résultante — la
// session expose ce lien en retour (`transaction`), d'où la recherche.
async function findSessionForTransaction(transactionId: string): Promise<SaspayCheckoutSession | null> {
  for (let page = 1; page <= 5; page += 1) {
    const list = await listPaidCheckoutSessions(page);
    const match = list.results.find((session) => session.transaction === transactionId);
    if (match) return match;
    if (!list.next) break;
  }
  return null;
}

export async function POST(request: Request) {
  const secret = process.env.SASPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");
  if (!verifySaspaySignature(rawBody, signature, timestamp, secret)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as SaspayWebhookEvent;
  if (event.event !== "transaction.success") return NextResponse.json({ received: true });

  const { id: transactionId, amount, currency } = event.data;
  const db = adminFirestoreOnly();

  const paymentRef = db.collection("transactions").doc(transactionId);
  const session = await findSessionForTransaction(transactionId);
  if (!session) {
    console.error("SasPay webhook: aucune session de checkout ne correspond à la transaction", transactionId);
    return NextResponse.json({ error: "Session de paiement temporairement introuvable" }, { status: 503 });
  }

  const uid = String(session.metadata.uid ?? "");
  const packId = String(session.metadata.packId ?? "");
  const pack = CAURIS_PACKS.find((item) => item.id === packId);
  const sessionSnapshot = await db.collection("checkoutSessions").doc(session.id).get();
  const sessionRecord = sessionSnapshot.data();

  if (!uid || !pack || !sessionRecord || sessionRecord.uid !== uid || sessionRecord.packId !== packId || Number(amount) !== pack.priceXof) {
    console.error("SasPay webhook: incohérence entre la session, ses métadonnées et le pack attendu", { transactionId, uid, packId, amount });
    return NextResponse.json({ received: true });
  }

  const walletRef = db.collection("wallets").doc(uid);
  const credited = await db.runTransaction(async (transaction) => {
    const existingPayment = await transaction.get(paymentRef);
    if (existingPayment.exists) return false;
    const walletSnapshot = await transaction.get(walletRef);
    const balance = Number(walletSnapshot.data()?.soldeCauris ?? 0);
    transaction.update(walletRef, { soldeCauris: balance + pack.credits, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(paymentRef, {
      uid,
      type: "credit",
      label: `Recharge ${pack.name}`,
      model: "GeoCauris",
      cauris: pack.credits,
      coutXof: pack.priceXof,
      currency,
      provider: "saspay",
      checkoutSessionId: session.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(db.collection("checkoutSessions").doc(session.id), { status: "paid", paidAt: FieldValue.serverTimestamp() });
    return true;
  });

  return NextResponse.json({ received: true, status: credited ? "wallet_credited" : "already_processed" });
}
