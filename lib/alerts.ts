import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function sendLowBalanceAlert(db: Firestore, ref: DocumentReference, label: string, balance: number, threshold: number) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const recipient = process.env.EMAILJS_ADMIN_EMAIL ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (!serviceId || !templateId || !publicKey || !recipient) return;
  const claimed = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const last = snapshot.data()?.lastAlertAt;
    const lastTime = last?.toMillis?.() ?? 0;
    if (Date.now() - lastTime < COOLDOWN_MS) return false;
    transaction.update(ref, { lastAlertAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) return;
  await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        to_email: recipient,
        subject: `Action requise : rechargez le solde Imọlẹ (${label})`,
        reserve_label: label,
        estimated_balance: balance.toLocaleString("fr-FR"),
        alert_threshold: threshold.toLocaleString("fr-FR"),
        recharge_url: process.env.NEXT_PUBLIC_APP_URL ?? "https://geocauris.vercel.app",
      },
    }),
  });
}
