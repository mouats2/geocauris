import { NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminFirestoreOnly } from "../../../lib/firebase-firestore-admin";
import { verifyFirebaseToken } from "../../../lib/admin";

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return NextResponse.json({ error: "Authentification Firebase requise." }, { status: 401 });
  let user;
  try { user = await verifyFirebaseToken(bearer.slice(7)); } catch { return NextResponse.json({ error: "Token Firebase invalide." }, { status: 401 }); }
  const rawKey = `cau_live_${crypto.randomBytes(24).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
  await adminFirestoreOnly().collection("apiKeys").add({ uid: user.uid, hash, status: "active", createdAt: FieldValue.serverTimestamp(), lastUsedAt: null, revokedAt: null });
  return NextResponse.json({ key: rawKey, warning: "Afficher cette clé une seule fois puis conserver uniquement le hash en base." });
}
