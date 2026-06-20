export type BridgeQuote = {
  grossEthIn: number;
  feeEth: number;
  netEthBridged: number;
  estimatedRbEthOut: number;
  routeStatus: "unknown" | "healthy" | "degraded" | "disabled";
};
