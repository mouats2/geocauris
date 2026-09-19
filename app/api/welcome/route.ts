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
      if (welcome.exists || wallet.data()?.welcomeCaurisGranted === true) return;
      if (!process.env.IMOLE_MASTER_API_KEY) throw new Error("WELCOME_MASTER_KEY_MISSING");
      transaction.set(walletRef, { uid: user.uid, soldeCauris: WELCOME_CREDITS, welcomeCaurisGranted: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(reservationRef, { uid: user.uid, cauris: WELCOME_CREDITS, source: "IMOLE_MASTER_API_KEY", createdAt: FieldValue.serverTimestamp() });
      transaction.set(db.collection("transactions").doc(), { uid: user.uid, type: "credit", label: "Bonus de bienvenue", model: "GeoCauris", cauris: WELCOME_CREDITS, source: "welcome", createdAt: FieldValue.serverTimestamp() });
      transaction.set(userRef, { welcomeCaurisGranted: true }, { merge: true });
    });
    return NextResponse.json({ granted: true, cauris: WELCOME_CREDITS });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "WELCOME_MASTER_KEY_MISSING") return NextResponse.json({ error: "La clé maître Imọlẹ (IMOLE_MASTER_API_KEY) n'est pas configurée sur le serveur." }, { status: 503 });
    console.error("welcome_credit_failed", { code, uid: user.uid });
    return NextResponse.json({ error: "Impossible d'activer le bonus de bienvenue. Vérifiez les variables Firebase Admin et la réserve Imọlẹ active." }, { status: 503 });
  }
}
