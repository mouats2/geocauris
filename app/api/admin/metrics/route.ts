import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { adminFirestoreOnly } from "../../../../lib/firebase-firestore-admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const db = adminFirestoreOnly();
    const [users, usageLogs, transactions, wallets] = await Promise.all([
      db.collection("users").get(),
      db.collection("usageLogs").get(),
      db.collection("transactions").get(),
      db.collection("wallets").get(),
    ]);
    const usageCauris = usageLogs.docs.reduce((total, item) => total + Number(item.data().coutCauris ?? item.data().cauris ?? 0), 0);
    const transactionCauris = transactions.docs.reduce((total, item) => total + (item.data().type === "debit" ? Number(item.data().cauris ?? 0) : 0), 0);
    const cauris = usageCauris + transactionCauris;
    return NextResponse.json({ metrics: { users: users.size, usage: usageLogs.size, transactions: transactions.size, cauris, walletCount: wallets.size } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "FORBIDDEN" ? "Accès administrateur requis" : "Métriques indisponibles" }, { status: code === "FORBIDDEN" ? 403 : 503 });
  }
}
