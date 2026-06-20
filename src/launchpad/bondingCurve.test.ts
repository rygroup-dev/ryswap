import { describe, it, expect } from "vitest";
import {
  CURVE,
  initialCurve,
  priceOf,
  buy,
  sell,
  marketCap,
  graduationProgress,
  isGraduated,
} from "./bondingCurve";

describe("bondingCurve", () => {
  it("initial price = virtualEth / curveSupply", () => {
    const c = initialCurve();
    expect(priceOf(c)).toBeCloseTo(CURVE.virtualEth / CURVE.curveSupply, 18);
  });

  it("buy raises price and lowers tokenReserve", () => {
    const c0 = initialCurve();
    const { tokensOut, curve } = buy(c0, 1);
    expect(tokensOut).toBeGreaterThan(0);
    expect(curve.tokenReserve).toBeLessThan(c0.tokenReserve);
    expect(priceOf(curve)).toBeGreaterThan(priceOf(c0));
    expect(curve.soldSupply).toBeCloseTo(tokensOut, 6);
  });

  it("preserves the constant product k across a buy", () => {
    const c0 = initialCurve();
    const k0 = (c0.virtualEth + c0.ethReserve) * c0.tokenReserve;
    const { curve } = buy(c0, 2);
    const k1 = (curve.virtualEth + curve.ethReserve) * curve.tokenReserve;
    expect(k1).toBeCloseTo(k0, 6);
  });

  it("buy then sell the same tokens returns ~the eth in", () => {
    const c0 = initialCurve();
    const { tokensOut, curve: c1 } = buy(c0, 1);
    const { ethOut } = sell(c1, tokensOut);
    expect(ethOut).toBeCloseTo(1, 6);
  });

  it("graduationProgress hits 1 at the graduation target", () => {
    const c = { ...initialCurve(), ethReserve: CURVE.graduationEth };
    expect(graduationProgress(c)).toBe(1);
    expect(isGraduated(c)).toBe(true);
  });

  it("marketCap is price * totalSupply", () => {
    const c = initialCurve();
    expect(marketCap(c)).toBeCloseTo(priceOf(c) * CURVE.totalSupply, 12);
  });
});
