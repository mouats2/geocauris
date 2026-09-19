import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestoreOnly } from "../../../lib/firebase-firestore-admin";
import { verifyFirebaseToken } from "../../../lib/admin";

const WELCOME_CREDITS = 50;

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  let user;
  try { user = await verifyFirebaseToken(bearer.slice(7)); } catch { return NextResponse.json({ error: "Token Firebase invalide" }, { status: 401 }); }
  const db = adminFirestoreOnly();
  const walletRef = db.collection("wallets").doc(user.uid);
  const userRef = db.collection("users").doc(user.uid);
  const reservationRef = db.collection("welcomeCredits").doc(user.uid);
  try {
    await db.runTransaction(async (transaction) => {
      const welcome = await transaction.get(reservationRef);
      const wallet = await transaction.get(walletRef);
      const pool = await transaction.get(db.collection("imoleKeys").limit(20));
      if (welcome.exists || wallet.data()?.welcomeCaurisGranted === true) return;
      const providerDoc = pool.docs.find((item) => {
        const data = item.data();
        return data.status === "active" && Number(data.estimatedBalance ?? 0) >= WELCOME_CREDITS;
      });
      if (!providerDoc) {
        if (pool.empty || !pool.docs.some((item) => item.data().status === "active")) throw new Error("WELCOME_POOL_UNAVAILABLE");
        throw new Error("WELCOME_POOL_INSUFFICIENT");
      }
      const providerRef = providerDoc.ref;
      const providerData = providerDoc.data();
      const providerBalance = Number(providerData.estimatedBalance ?? 0);
      if (providerBalance < WELCOME_CREDITS) throw new Error("WELCOME_POOL_INSUFFICIENT");
      transaction.set(walletRef, { uid: user.uid, soldeCauris: WELCOME_CREDITS, welcomeCaurisGranted: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.update(providerRef, { estimatedBalance: providerBalance - WELCOME_CREDITS, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(reservationRef, { uid: user.uid, cauris: WELCOME_CREDITS, providerKeyId: providerRef.id, createdAt: FieldValue.serverTimestamp() });
      transaction.set(db.collection("transactions").doc(), { uid: user.uid, type: "credit", label: "Bonus de bienvenue", model: "GeoCauris", cauris: WELCOME_CREDITS, source: "welcome", createdAt: FieldValue.serverTimestamp() });
      transaction.set(userRef, { welcomeCaurisGranted: true }, { merge: true });
    });
    return NextResponse.json({ granted: true, cauris: WELCOME_CREDITS });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "WELCOME_POOL_INSUFFICIENT") return NextResponse.json({ error: "Le bonus de bienvenue est temporairement indisponible." }, { status: 503 });
    if (code === "WELCOME_POOL_UNAVAILABLE") return NextResponse.json({ error: "Aucune réserve Imọlẹ active n'est configurée." }, { status: 503 });
    console.error("welcome_credit_failed", { code, uid: user.uid });
    return NextResponse.json({ error: "Impossible d'activer le bonus de bienvenue. Vérifiez les variables Firebase Admin et la réserve Imọlẹ active." }, { status: 503 });
  }
}
