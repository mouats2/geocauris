import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  createCheckoutSession: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  db: { collection: vi.fn() },
  verifySaspaySignature: vi.fn(),
  listPaidCheckoutSessions: vi.fn(),
}));

vi.mock("../lib/admin", () => ({ requireUser: mocks.user }));
vi.mock("../lib/rate-limit", () => ({ checkRateLimitAsync: mocks.checkRateLimitAsync }));
vi.mock("../lib/saspay", () => ({ createCheckoutSession: mocks.createCheckoutSession, verifySaspaySignature: mocks.verifySaspaySignature, listPaidCheckoutSessions: mocks.listPaidCheckoutSessions }));
vi.mock("../lib/firebase-firestore-admin", () => ({ adminFirestoreOnly: () => mocks.db }));

describe("payment routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ uid: "uid-1", email: "client@example.com" });
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
    mocks.createCheckoutSession.mockResolvedValue({ checkout_url: "https://checkout.example.test/session" });
    mocks.db.collection.mockReturnValue({ doc: () => ({ set: vi.fn() }) });
    process.env.SASPAY_SECRET_KEY = "test-key";
  });

  it("creates a server-priced checkout for an authenticated user", async () => {
    const { POST } = await import("../app/api/payments/saspay/route");
    const response = await POST(new Request("http://localhost/api/payments/saspay", { method: "POST", body: JSON.stringify({ packId: "pack-250" }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ paymentUrl: "https://checkout.example.test/session" });
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ amount: "350.00", customer_email: "client@example.com", metadata: expect.objectContaining({ uid: "uid-1", credits: 250 }) }));
  });

  it("rejects a webhook with an invalid signature", async () => {
    process.env.SASPAY_WEBHOOK_SECRET = "webhook-secret";
    mocks.verifySaspaySignature.mockReturnValue(false);
    const { POST } = await import("../app/api/webhooks/saspay/route");
    const response = await POST(new Request("http://localhost/api/webhooks/saspay", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
    expect(mocks.listPaidCheckoutSessions).not.toHaveBeenCalled();
  });
});
