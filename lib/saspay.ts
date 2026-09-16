import crypto from "crypto";

const BASE_URL = "https://api.saspay.me/api/v1";

type SaspaySuccess<T> = { success: true; data: T; code: number };
type SaspayFailure = { success: false; error: { message?: string; code?: string } | Record<string, string[]>; code: number };
type SaspayEnvelope<T> = SaspaySuccess<T> | SaspayFailure;

function secretKey() {
  const key = process.env.SASPAY_SECRET_KEY;
  if (!key) throw new Error("SASPAY_SECRET_KEY_MISSING");
  return key;
}

async function saspayRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as SaspayEnvelope<T> | null;
  if (!response.ok || !payload || payload.success !== true) {
    const errorField = payload && payload.success === false ? payload.error : null;
    const message = errorField && typeof errorField === "object" && "message" in errorField && typeof errorField.message === "string" ? errorField.message : `SasPay a répondu ${response.status}`;
    throw new Error(message);
  }
  return payload.data;
}

export type SaspayCheckoutSession = {
  id: string;
  checkout_url: string;
  amount: string;
  currency: string;
  description: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";
  transaction: string | null;
  metadata: Record<string, unknown>;
  paid_at: string | null;
};

export function createCheckoutSession(params: {
  amount: string;
  currency: string;
  description: string;
  country?: string;
  customer_email: string;
  customer_name: string;
  return_url?: string;
  metadata?: Record<string, unknown>;
}) {
  return saspayRequest<SaspayCheckoutSession>("/checkout-sessions/", { method: "POST", body: JSON.stringify(params) });
}

export type SaspayCheckoutSessionList = { count: number; next: string | null; results: SaspayCheckoutSession[] };

export function listPaidCheckoutSessions(page = 1) {
  return saspayRequest<SaspayCheckoutSessionList>(`/checkout-sessions/?status=PAID&page_size=100&page=${page}`);
}

const SIGNATURE_TOLERANCE_SECONDS = 300;

export function verifySaspaySignature(rawBody: string, signatureHeader: string | null, timestampHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !timestampHeader) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestampHeader}.${rawBody}`).digest("hex");
  const received = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);
  return received.length === computed.length && crypto.timingSafeEqual(received, computed);
}

export type SaspayWebhookEvent = {
  event: string;
  data: {
    id: string;
    reference: string;
    type?: string;
    status: string;
    amount: string;
    fee?: string;
    charged?: string;
    net_amount: string;
    fee_charge_mode?: string;
    currency: string;
    country?: string;
    network?: string;
    msisdn?: string;
  };
};
