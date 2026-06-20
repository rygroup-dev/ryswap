import { describe, it, expect, beforeEach } from "vitest";
import { createMockLaunchpad } from "./mockProvider";

// jsdom-free: provide a tiny localStorage shim for the node test env.
class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe("mockProvider", () => {
  let lp: ReturnType<typeof createMockLaunchpad>;
  beforeEach(() => {
    lp = createMockLaunchpad(new MemStore() as unknown as Storage, { seed: false, simulate: false });
  });

  it("creates a token with an initial curve", async () => {
    const t = await lp.createToken({
      name: "Test", ticker: "TST", image: "", description: "", creator: "0xabc",
    });
    expect(t.ticker).toBe("TST");
    expect(t.curve.ethReserve).toBe(0);
    expect(t.graduated).toBe(false);
    expect(await lp.getToken(t.id)).not.toBeNull();
  });

  it("buy increases the creator's holder balance and adds a trade", async () => {
    const t = await lp.createToken({
      name: "Test", ticker: "TST", image: "", description: "", creator: "0xabc",
    });
    const after = await lp.buy(t.id, 0.5, "0xbuyer");
    expect(after.trades.length).toBe(1);
    expect(after.trades[0].kind).toBe("buy");
    const holder = after.holders.find((h) => h.account === "0xbuyer");
    expect(holder).toBeTruthy();
    expect(holder!.balance).toBeGreaterThan(0);
    expect(after.curve.ethReserve).toBeCloseTo(0.5, 9);
  });

  it("sell reduces balance and eth reserve", async () => {
    const t = await lp.createToken({
      name: "Test", ticker: "TST", image: "", description: "", creator: "0xabc",
    });
    const bought = await lp.buy(t.id, 1, "0xbuyer");
    const bal = bought.holders.find((h) => h.account === "0xbuyer")!.balance;
    const sold = await lp.sell(t.id, bal / 2, "0xbuyer");
    expect(sold.holders.find((h) => h.account === "0xbuyer")!.balance).toBeCloseTo(bal / 2, 6);
    expect(sold.curve.ethReserve).toBeLessThan(bought.curve.ethReserve);
  });

  it("graduates when eth reserve crosses the target", async () => {
    const t = await lp.createToken({
      name: "Big", ticker: "BIG", image: "", description: "", creator: "0xabc",
    });
    const after = await lp.buy(t.id, 10, "0xwhale");
    expect(after.graduated).toBe(true);
    const graduated = await lp.listTokens("graduated");
    expect(graduated.some((x) => x.id === t.id)).toBe(true);
  });
});
