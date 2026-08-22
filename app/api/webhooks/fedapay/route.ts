import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestoreOnly } from "../../../../lib/firebase-firestore-admin";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const expectedSecret = process.env.FEDAPAY_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get("x-fedapay-webhook-secret");
  if (expectedSecret && receivedSecret !== expectedSecret) return NextResponse.json({ error: "Webhook non autorisé" }, { status: 401 });
  const event = JSON.parse(rawBody || "{}");
  const transaction = event.transaction ?? event.data?.transaction ?? event.data ?? event;
  const status = String(transaction.status ?? transaction.state ?? "").toLowerCase();
  if (["approved", "transferred", "paid"].includes(status)) {
    const transactionId = String(transaction.id ?? transaction.reference ?? "");
    const metadata = transaction.custom_metadata ?? transaction.metadata ?? {};
    const uid = String(metadata.uid ?? "");
    const credits = Number(metadata.credits ?? 0);
    if (!transactionId || !uid || !credits) return NextResponse.json({ error: "Métadonnées FedaPay incomplètes" }, { status: 400 });
    const db = adminFirestoreOnly();
    const eventRef = db.collection("fedapayTransactions").doc(transactionId);
    const walletRef = db.collection("wallets").doc(uid);
    const result = await db.runTransaction(async (firestoreTransaction) => {
      const eventSnapshot = await firestoreTransaction.get(eventRef);
      if (eventSnapshot.exists) return false;
      const walletSnapshot = await firestoreTransaction.get(walletRef);
      const currentBalance = Number(walletSnapshot.data()?.soldeCauris ?? 0);
      firestoreTransaction.set(walletRef, { uid, soldeCauris: currentBalance + credits, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      firestoreTransaction.set(db.collection("transactions").doc(), { uid, type: "credit", label: "Recharge FedaPay", fournisseur: "fedapay", referenceExterne: transactionId, cauris: credits, montantXOF: Number(transaction.amount ?? 0), statut: "approved", createdAt: FieldValue.serverTimestamp() });
      firestoreTransaction.set(eventRef, { uid, credits, status, processedAt: FieldValue.serverTimestamp() });
      return true;
    });
    return NextResponse.json({ received: true, status: result ? "wallet_credited" : "already_processed", transactionId });
  }
  return NextResponse.json({ received: true, status: status || "received" });
}
