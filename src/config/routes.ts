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
    id: "relay-legacy",
    label: "Relay legacy route",
    status: "disabled",
    summary:
      "The old RoboBridge path depends on Relay, but current live checks return CHAIN_DISABLED for 1 <-> 4663.",
    evidence: [
      "config/v2 returned enabled:false for 1 -> 4663",
      "config/v2 returned enabled:false for 4663 -> 1",
      "/quote returned CHAIN_DISABLED in both directions"
    ]
  },
  {
    id: "rbeth-owner-mint",
    label: "Observed rbETH mint flow",
    status: "observed",
    summary:
      "rbETH exists on-chain, but explorer evidence currently points to a custom owner-minted token rather than a public bridge route.",
    evidence: [
      "rbETH token deployed at 0x9c497572F6Ab96Cb6859EcDb0FBAD87F852c8F35",
      "creation tx: 0xfea3632d4a0b1e704c7f651dfd4a08c96ac631cf4b0495b41e3c55884c68e752",
      "observed mint tx: 0xb138a9e9d82ef1b46dd22e0b1cec015c8cc802ab956a42d822fa7622d43fbf32"
    ]
  }
];

export function hasBindableRoute() {
  return routeCandidates.some((route) => route.status === "ready");
}
