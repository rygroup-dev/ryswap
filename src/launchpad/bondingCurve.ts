import type { CurveState } from "./types";

// Tunable launchpad economics. Kept in one object so the eventual on-chain
// contracts can mirror these exact numbers.
export const CURVE = {
  totalSupply: 1_000_000_000, // 1B total token supply
  curveSupply: 800_000_000, // tokens sold through the curve
  virtualEth: 1.0, // virtual ETH reserve offset (x0)
  graduationEth: 4.0, // real ETH raised to graduate to the DEX
};

// Constant-product virtual reserves:
//   x = virtualEth + ethReserve   (effective ETH)
//   y = tokenReserve              (effective token reserve)
//   k = x * y is invariant; virtualToken = curveSupply = initial y.
export function initialCurve(): CurveState {
  return {
    ethReserve: 0,
    tokenReserve: CURVE.curveSupply,
    virtualEth: CURVE.virtualEth,
    virtualToken: CURVE.curveSupply,
    soldSupply: 0,
  };
}

function k(c: CurveState): number {
  return c.virtualEth * c.virtualToken;
}

export function priceOf(c: CurveState): number {
  return (c.virtualEth + c.ethReserve) / c.tokenReserve;
}

export function buy(c: CurveState, ethIn: number): { tokensOut: number; curve: CurveState } {
  const x = c.virtualEth + c.ethReserve;
  const newX = x + ethIn;
  const newY = k(c) / newX;
  const tokensOut = c.tokenReserve - newY;
  return {
    tokensOut,
    curve: {
      ...c,
      ethReserve: c.ethReserve + ethIn,
      tokenReserve: newY,
      soldSupply: c.soldSupply + tokensOut,
    },
  };
}

export function sell(c: CurveState, tokensIn: number): { ethOut: number; curve: CurveState } {
  const x = c.virtualEth + c.ethReserve;
  const newY = c.tokenReserve + tokensIn;
  const newX = k(c) / newY;
  const ethOut = x - newX;
  return {
    ethOut,
    curve: {
      ...c,
      ethReserve: c.ethReserve - ethOut,
      tokenReserve: newY,
      soldSupply: c.soldSupply - tokensIn,
    },
  };
}

export function marketCap(c: CurveState): number {
  return priceOf(c) * CURVE.totalSupply;
}

export function graduationProgress(c: CurveState): number {
  return Math.min(c.ethReserve / CURVE.graduationEth, 1);
}

export function isGraduated(c: CurveState): boolean {
  return c.ethReserve >= CURVE.graduationEth;
}
