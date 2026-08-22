import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestoreOnly } from "../../../../lib/firebase-firestore-admin";
import { encryptSecret, requireAdmin } from "../../../../lib/admin";

export async function GET(request: Request) {
  try { await requireAdmin(request); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Accès administrateur requis" : "Authentification requise" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }); }
  try {
    const snapshot = await adminFirestoreOnly().collection("imoleKeys").orderBy("createdAt", "desc").get();
    return NextResponse.json({ keys: snapshot.docs.map((item) => { const data = item.data(); return { id: item.id, label: data.label, status: data.status, startingBalance: data.startingBalance, estimatedBalance: data.estimatedBalance, alertThreshold: data.alertThreshold, lastAlertAt: data.lastAlertAt ?? null }; }) });
  } catch (error) { console.error("imole_keys_get_failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Firestore indisponible" }, { status: 503 }); }
}

export async function POST(request: Request) {
  try { await requireAdmin(request); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Accès administrateur requis" : "Authentification requise" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }); }
  const body = await request.json().catch(() => ({}));
  if (!body.rawKey || !body.label || Number(body.startingBalance) <= 0) return NextResponse.json({ error: "label, rawKey et startingBalance sont obligatoires" }, { status: 400 });
  try {
    const startingBalance = Number(body.startingBalance);
    const alertThreshold = Number(body.alertThreshold ?? Math.round(startingBalance * 0.1));
    const ref = await adminFirestoreOnly().collection("imoleKeys").add({ label: body.label, encryptedKey: encryptSecret(body.rawKey), status: "active", startingBalance, estimatedBalance: startingBalance, alertThreshold, lastAlertAt: null, lastRechargeAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ id: ref.id, status: "created" }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de chiffrer la clé" }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  try { await requireAdmin(request); } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "FORBIDDEN" ? "Accès administrateur requis" : "Authentification requise" }, { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401 }); }
  const body = await request.json().catch(() => ({}));
  if (!body.id || !["recharge", "toggle"].includes(body.action)) return NextResponse.json({ error: "id et action sont obligatoires" }, { status: 400 });
  const ref = adminFirestoreOnly().collection("imoleKeys").doc(String(body.id));
  const snapshot = await ref.get();
  if (!snapshot.exists) return NextResponse.json({ error: "Clé Imọlẹ introuvable" }, { status: 404 });
  const data = snapshot.data() ?? {};
  if (body.action === "recharge") {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Le montant de recharge doit être positif" }, { status: 400 });
    await ref.update({ estimatedBalance: Number(data.estimatedBalance ?? 0) + amount, status: "active", lastRechargeAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  } else {
    const nextStatus = data.status === "active" ? "inactive" : "active";
    await ref.update({ status: nextStatus, updatedAt: FieldValue.serverTimestamp() });
  }
  return NextResponse.json({ status: "updated" });
}
