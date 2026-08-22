import { NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue, type Firestore, type DocumentReference } from "firebase-admin/firestore";
import { adminFirestoreOnly } from "../../../lib/firebase-firestore-admin";
import { decryptSecret } from "../../../lib/admin";
import { estimateCaurisCost } from "../../../lib/pricing";
import { sendLowBalanceAlert } from "../../../lib/alerts";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer cau_")) return NextResponse.json({ error: { message: "Clé API GeoCauris invalide", type: "authentication_error" } }, { status: 401 });
  const baseUrl = process.env.IMOLE_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: { message: "Le fournisseur IA n'est pas configuré côté serveur", type: "configuration_error" } }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || body.stream === true) return NextResponse.json({ error: { message: body?.stream ? "Le streaming sera activé après validation du débit final." : "Corps JSON invalide", type: "invalid_request_error" } }, { status: 400 });

  const db = adminFirestoreOnly();
  const activePool = await db.collection("imoleKeys").where("status", "==", "active").limit(1).get();
  let providerKey = process.env.IMOLE_MASTER_API_KEY;
  let providerKeyRef = activePool.empty ? null : activePool.docs[0];
  if (providerKeyRef) {
    try { providerKey = decryptSecret(String(providerKeyRef.data().encryptedKey)); } catch { return NextResponse.json({ error: { message: "La clé Imọlẹ active ne peut pas être déchiffrée", type: "configuration_error" } }, { status: 503 }); }
  }
  if (!providerKey) return NextResponse.json({ error: { message: "Aucune clé Imọlẹ active n'est configurée", type: "configuration_error" } }, { status: 503 });
  const keyHash = crypto.createHash("sha256").update(auth.slice(7)).digest("hex");
  const keySnapshot = await db.collection("apiKeys").where("hash", "==", keyHash).limit(1).get();
  if (keySnapshot.empty) return NextResponse.json({ error: { message: "Clé API GeoCauris inconnue", type: "authentication_error" } }, { status: 401 });
  const keyDocument = keySnapshot.docs[0];
  const key = keyDocument.data();
  if (key.status !== "active" || !key.uid) return NextResponse.json({ error: { message: "Clé API révoquée ou inactive", type: "authentication_error" } }, { status: 401 });

  const model = String(body.model ?? "gpt-5.6-luna");
  const effort = String(body.reasoning_effort ?? body.reasoning?.effort ?? "medium");
  const reservedCauris = estimateCaurisCost(model, effort);
  const walletRef = db.collection("wallets").doc(key.uid);
  const reservationRef = db.collection("usageReservations").doc();
  try {
    await db.runTransaction(async (transaction) => {
      const walletSnapshot = await transaction.get(walletRef);
      const balance = Number(walletSnapshot.data()?.soldeCauris ?? 0);
      if (balance < reservedCauris) throw new Error("INSUFFICIENT_CAURIS");
      transaction.update(walletRef, { soldeCauris: balance - reservedCauris, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(reservationRef, { uid: key.uid, keyId: keyDocument.id, model, effort, reservedCauris, status: "pending", createdAt: FieldValue.serverTimestamp() });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CAURIS") return NextResponse.json({ error: { message: "Solde de cauris insuffisant", type: "insufficient_quota" } }, { status: 402 });
    throw error;
  }

  try {
    const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/responses`, { method: "POST", headers: { Authorization: `Bearer ${providerKey}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const responseText = await upstream.text();
    const parsed = JSON.parse(responseText || "{}");
    const inputTokens = Number(parsed.usage?.input_tokens ?? 0);
    const outputTokens = Number(parsed.usage?.output_tokens ?? 0);
    if (!upstream.ok) await refundReservation(db, reservationRef, walletRef, reservedCauris, "provider_error");
    else await db.runTransaction(async (transaction) => {
      transaction.update(reservationRef, { status: "committed", inputTokens, outputTokens, completedAt: FieldValue.serverTimestamp() });
      transaction.update(keyDocument.ref, { lastUsedAt: FieldValue.serverTimestamp() });
      if (providerKeyRef) {
        const providerBalance = Number(providerKeyRef.data().estimatedBalance ?? 0) - reservedCauris;
        transaction.update(providerKeyRef.ref, { estimatedBalance: providerBalance, status: providerBalance <= 0 ? "exhausted" : "active", lastUsedAt: FieldValue.serverTimestamp() });
      }
      transaction.set(db.collection("usageLogs").doc(), { uid: key.uid, keyId: keyDocument.id, model, effort, tokensEntree: inputTokens, tokensSortie: outputTokens, coutCauris: reservedCauris, createdAt: FieldValue.serverTimestamp() });
    });
    if (providerKeyRef) {
      const latestProvider = await providerKeyRef.ref.get();
      const providerData = latestProvider.data() ?? {};
      const estimatedBalance = Number(providerData.estimatedBalance ?? 0);
      if (estimatedBalance <= Number(providerData.alertThreshold ?? 0)) await sendLowBalanceAlert(db, providerKeyRef.ref, String(providerData.label ?? "Réserve Imọlẹ"), estimatedBalance, Number(providerData.alertThreshold ?? 0));
    }
    return new NextResponse(responseText, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch (error) {
    await refundReservation(db, reservationRef, walletRef, reservedCauris, "provider_error");
    return NextResponse.json({ error: { message: "Le fournisseur IA est momentanément indisponible", type: "upstream_error" } }, { status: 502 });
  }
}

async function refundReservation(db: Firestore, reservationRef: DocumentReference, walletRef: DocumentReference, amount: number, reason: string) {
  await db.runTransaction(async (transaction) => {
    const walletSnapshot = await transaction.get(walletRef);
    transaction.update(walletRef, { soldeCauris: Number(walletSnapshot.data()?.soldeCauris ?? 0) + amount, updatedAt: FieldValue.serverTimestamp() });
    transaction.update(reservationRef, { status: "refunded", reason, refundedAt: FieldValue.serverTimestamp() });
  });
}
