import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { adminFirestoreOnly } from "../../../../lib/firebase-firestore-admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const db = adminFirestoreOnly();
    const [users, usageLogs, transactions] = await Promise.all([
      db.collection("users").get(),
      db.collection("usageLogs").get(),
      db.collection("transactions").get(),
    ]);
    const cauris = usageLogs.docs.reduce((total, item) => total + Number(item.data().coutCauris ?? item.data().cauris ?? 0), 0);
    return NextResponse.json({ metrics: { users: users.size, usage: usageLogs.size, transactions: transactions.size, cauris } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "FORBIDDEN" ? "Accès administrateur requis" : "Métriques indisponibles" }, { status: code === "FORBIDDEN" ? 403 : 503 });
  }
}
