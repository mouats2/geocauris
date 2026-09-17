import { describe, expect, it } from "vitest";
import crypto from "crypto";
import { verifySaspaySignature } from "../lib/saspay";

describe("SasPay webhook signatures", () => {
  it("accepts a valid recent signature", () => {
    const body = JSON.stringify({ event: "transaction.success" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto.createHmac("sha256", "test-secret").update(`${timestamp}.${body}`).digest("hex");
    expect(verifySaspaySignature(body, signature, timestamp, "test-secret")).toBe(true);
  });

  it("rejects a stale signature", () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 301);
    expect(verifySaspaySignature("{}", "invalid", timestamp, "test-secret")).toBe(false);
  });
});
