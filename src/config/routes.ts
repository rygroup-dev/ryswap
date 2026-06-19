export type RouteCandidateStatus =
  | "ready"
  | "disabled"
  | "observed"
  | "unknown";

export type RouteCandidate = {
  id: string;
  label: string;
  status: RouteCandidateStatus;
  summary: string;
  evidence: string[];
};

export const routeCandidates: RouteCandidate[] = [
  {
    id: "arbitrum-native",
    label: "Arbitrum native bridge (depositEth)",
    status: "ready",
    summary:
      "Deposit ETH into the canonical Arbitrum Inbox on Ethereum L1. Native ETH appears on Robinhood Chain within ~10-15 minutes.",
    evidence: [
      "Inbox contract verified at 0x1A07cc4BD17E0118BdB54D70990D2158AbAD7a2D (TransparentUpgradeableProxy → Inbox)",
      "Bridge contract at 0xDf8755334Ce7a73cCF6B581c02Ea649AE3e864B3",
      "Active createRetryableTicket + depositEth calls observed on-chain",
      "L1 settlement confirmed: Ethereum mainnet block ~25350xxx",
    ],
  },
  {
    id: "relay-multichain",
    label: "Relay multichain bridge",
    status: "disabled",
    summary:
      "Relay /quote and /execute/swap return CHAIN_DISABLED for chain 4663. Auto-enables when Relay lists it.",
    evidence: [
      "config/v2 returned enabled:false for 1 -> 4663",
      "config/v2 returned enabled:false for 4663 -> 1",
      "/quote returned CHAIN_DISABLED in both directions",
    ],
  },
  {
    id: "rbeth-owner-mint",
    label: "Observed rbETH mint flow",
    status: "observed",
    summary:
      "rbETH exists on-chain, but mint is controlled by a private operator wallet. Not integrable without owner cooperation.",
    evidence: [
      "rbETH token deployed at 0x9c497572F6Ab96Cb6859EcDb0FBAD87F852c8F35",
      "creation tx: 0xfea3632d4a0b1e704c7f651dfd4a08c96ac631cf4b0495b41e3c55884c68e752",
      "mint controlled by owner 0x263371bf95a2ca5C249221b3c14D98AB3D3b4C22 via custom selector 0x4c148905",
    ],
  },
];

export function hasBindableRoute() {
  return routeCandidates.some((route) => route.status === "ready");
}
