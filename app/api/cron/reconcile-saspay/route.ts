import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestoreOnly } from "../../../../lib/firebase-firestore-admin";
import { listPaidCheckoutSessions, type SaspayCheckoutSession } from "../../../../lib/saspay";
import { CAURIS_PACKS } from "../../../../lib/pricing";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function reconcileSession(db: ReturnType<typeof adminFirestoreOnly>, session: SaspayCheckoutSession) {
  if (!session.transaction) return false;
  const localRef = db.collection("checkoutSessions").doc(session.id);
  const localSnapshot = await localRef.get();
  const local = localSnapshot.data();
  if (!local || local.status === "paid") return false;
  const pack = CAURIS_PACKS.find((item) => item.id === local.packId);
  if (!pack || Number(session.amount) !== pack.priceXof || Number(local.priceXof) !== pack.priceXof) return false;
  const uid = String(local.uid ?? "");
  if (!uid) return false;
  const paymentRef = db.collection("transactions").doc(String(session.transaction));
  const walletRef = db.collection("wallets").doc(uid);
  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(paymentRef);
    if (existing.exists) {
      transaction.update(localRef, { status: "paid", paidAt: FieldValue.serverTimestamp(), reconciledAt: FieldValue.serverTimestamp() });
      return false;
    }
    const wallet = await transaction.get(walletRef);
    const balance = Number(wallet.data()?.soldeCauris ?? 0);
    transaction.update(walletRef, { soldeCauris: balance + pack.credits, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(paymentRef, { uid, type: "credit", label: `Recharge ${pack.name}`, model: "GeoCauris", cauris: pack.credits, coutXof: pack.priceXof, currency: session.currency, provider: "saspay", checkoutSessionId: session.id, reconciled: true, createdAt: FieldValue.serverTimestamp() });
    transaction.update(localRef, { status: "paid", paidAt: FieldValue.serverTimestamp(), reconciledAt: FieldValue.serverTimestamp() });
    return true;
  });
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const db = adminFirestoreOnly();
  let scanned = 0;
  let credited = 0;
  for (let page = 1; page <= 5; page += 1) {
    const list = await listPaidCheckoutSessions(page);
    for (const session of list.results) {
      scanned += 1;
      if (await reconcileSession(db, session)) credited += 1;
    }
    if (!list.next) break;
  }
  return NextResponse.json({ scanned, credited });
}
