import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin";
import { adminFirestoreOnly } from "../../../../lib/firebase-firestore-admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const db = adminFirestoreOnly();
    const [users, usageLogs, transactions, wallets, checkoutSessions] = await Promise.all([
      db.collection("users").get(),
      db.collection("usageLogs").get(),
      db.collection("transactions").get(),
      db.collection("wallets").get(),
      db.collection("checkoutSessions").get(),
    ]);
    const userIds = new Set(users.docs.map((doc) => doc.id));
    const transactionUsers = new Set(transactions.docs.map((doc) => String(doc.data().uid ?? "")).filter(Boolean));
    const sessionUsers = new Set(checkoutSessions.docs.map((doc) => String(doc.data().uid ?? "")).filter(Boolean));
    const userCount = new Set([...userIds, ...transactionUsers, ...sessionUsers]).size;
    const usageCauris = usageLogs.docs.reduce((total, item) => total + Number(item.data().coutCauris ?? item.data().cauris ?? 0), 0);
    const transactionCauris = transactions.docs.reduce((total, item) => total + (item.data().type === "debit" ? Number(item.data().cauris ?? 0) : 0), 0);
    const paidSessions = checkoutSessions.docs.filter((doc) => doc.data().status === "paid");
    const revenue = paidSessions.reduce((total, doc) => total + Number(doc.data().priceXof ?? 0), 0);
    const purchases = transactions.docs.filter((doc) => doc.data().type === "credit").map((doc) => {
      const data = doc.data();
      return { id: doc.id, uid: String(data.uid ?? ""), label: String(data.label ?? "Achat de cauris"), cauris: Number(data.cauris ?? 0), amountXof: Number(data.coutXof ?? 0), createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null };
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 100);
    const cauris = usageCauris + transactionCauris;
    return NextResponse.json({ metrics: { users: userCount, usage: usageLogs.size, transactions: transactions.size, cauris, walletCount: wallets.size, revenue, purchases } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "FORBIDDEN" ? "Accès administrateur requis" : "Métriques indisponibles" }, { status: code === "FORBIDDEN" ? 403 : 503 });
  }
}
