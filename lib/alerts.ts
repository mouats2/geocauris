import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function sendLowBalanceAlert(db: Firestore, ref: DocumentReference, label: string, balance: number, threshold: number) {
  const resendKey = process.env.RESEND_API_KEY;
  const recipient = process.env.ADMIN_ALERT_EMAIL ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (!resendKey || !recipient) return;
  const claimed = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const last = snapshot.data()?.lastAlertAt;
    const lastTime = last?.toMillis?.() ?? 0;
    if (Date.now() - lastTime < COOLDOWN_MS) return false;
    transaction.update(ref, { lastAlertAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) return;
  await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.ALERT_FROM_EMAIL ?? "GeoCauris <onboarding@resend.dev>", to: [recipient], subject: `Alerte stock Imọlẹ : ${label}`, html: `<p>La réserve Imọlẹ <strong>${label}</strong> est proche de l'épuisement.</p><p>Solde estimé : <strong>${balance.toLocaleString("fr-FR")} cauris</strong><br>Seuil configuré : <strong>${threshold.toLocaleString("fr-FR")} cauris</strong></p><p>Rechargez la réserve puis utilisez « Recalibrer le solde » dans l'administration GeoCauris.</p>` }) });
}
