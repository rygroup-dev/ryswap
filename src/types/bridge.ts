export type BridgeQuote = {
  grossEthIn: number;
  feeEth: number;
  netEthBridged: number;
  estimatedRbEthOut: number;
  routeStatus: "unknown" | "healthy" | "degraded" | "disabled";
};

export type ExecutionStepKey =
  | "feeTransfer"
  | "bridgeDeposit"
  | "destinationReceive";

export type ExecutionStepState = "pending" | "ready" | "complete" | "error";

export type ExecutionStep = {
  key: ExecutionStepKey;
  title: string;
  description: string;
  status: ExecutionStepState;
};

export type PreparedBridgeExecution = {
  grossWei: bigint;
  feeWei: bigint;
  netBridgeWei: bigint;
  grossEthFormatted: string;
  feeEthFormatted: string;
  netEthFormatted: string;
  feeRecipient: string;
  routeBindingNote: string;
  steps: ExecutionStep[];
};
