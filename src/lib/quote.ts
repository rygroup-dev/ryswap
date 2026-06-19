import { feeConfig } from "../config/fees";
import type { BridgeQuote } from "../types/bridge";

export function estimateQuote(amountEth: number): BridgeQuote {
  const safeAmount = Number.isFinite(amountEth) && amountEth > 0 ? amountEth : 0;
  const feeEth = (safeAmount * feeConfig.bps) / 10_000;
  const netEthBridged = Math.max(0, safeAmount - feeEth);

  return {
    grossEthIn: safeAmount,
    feeEth,
    netEthBridged,
    estimatedRbEthOut: netEthBridged,
    routeStatus: safeAmount > 0 ? "unknown" : "disabled"
  };
}
