import { describe, expect, it } from "vitest";
import { CAURIS_PACKS, estimateCaurisCost } from "../lib/pricing";

describe("GeoCauris pricing", () => {
  it("keeps the five published packs", () => {
    expect(CAURIS_PACKS.map((pack) => [pack.credits, pack.priceXof])).toEqual([
      [250, 350], [500, 700], [1000, 1400], [2500, 3500], [5000, 7000],
    ]);
  });

  it("charges a positive amount for a supported model", () => {
    expect(estimateCaurisCost("gpt-5.6-luna", "medium")).toBeGreaterThan(0);
  });
});
