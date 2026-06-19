// Relay.link multichain bridge configuration.
// Non-custodial: Relay relayers move funds across chains; we add a transparent
// app fee via Relay's native `appFees` field. No contract deploy required.

export const RELAY_API = "https://api.relay.link";

// Our bridge platform fee (basis points). 150 = 1.5%.
export const BRIDGE_FEE_BPS = Number(import.meta.env.VITE_BRIDGE_FEE_BPS || 150);

// Fee recipient (clean wallet).
export const BRIDGE_FEE_RECIPIENT =
  (import.meta.env.VITE_FEE_RECIPIENT as string) ||
  "0x327F53A3D8fCb1d35fF549234a982D057aa1976C";

export const NATIVE = "0x0000000000000000000000000000000000000000";

export type BridgeChain = {
  id: number;
  name: string;
  short: string;
  hex: string;
  rpc: string;
  explorer: string;
  // When true, the chain is not yet live on Relay (e.g. Robinhood Chain).
  pending?: boolean;
};

// Chains verified live on Relay (api.relay.link/chains) + Robinhood Chain pending.
export const bridgeChains: BridgeChain[] = [
  { id: 1, name: "Ethereum", short: "ETH", hex: "0x1", rpc: "https://ethereum-rpc.publicnode.com", explorer: "https://etherscan.io" },
  { id: 42161, name: "Arbitrum", short: "ARB", hex: "0xa4b1", rpc: "https://arbitrum-one-rpc.publicnode.com", explorer: "https://arbiscan.io" },
  { id: 10, name: "Optimism", short: "OP", hex: "0xa", rpc: "https://optimism-rpc.publicnode.com", explorer: "https://optimistic.etherscan.io" },
  { id: 8453, name: "Base", short: "BASE", hex: "0x2105", rpc: "https://base-rpc.publicnode.com", explorer: "https://basescan.org" },
  { id: 534352, name: "Scroll", short: "SCRL", hex: "0x82750", rpc: "https://scroll-rpc.publicnode.com", explorer: "https://scrollscan.com" },
  { id: 137, name: "Polygon", short: "POL", hex: "0x89", rpc: "https://polygon-bor-rpc.publicnode.com", explorer: "https://polygonscan.com" },
  { id: 59144, name: "Linea", short: "LINEA", hex: "0xe708", rpc: "https://linea-rpc.publicnode.com", explorer: "https://lineascan.build" },
  { id: 81457, name: "Blast", short: "BLAST", hex: "0x13e31", rpc: "https://blast-rpc.publicnode.com", explorer: "https://blastscan.io" },
  // Robinhood Chain — not yet on Relay. Auto-enables when Relay lists it.
  { id: 4663, name: "Robinhood Chain", short: "RH", hex: "0x1237", rpc: "https://poptye-always-win.poptyedev.com", explorer: "https://so-explorer.poptyedev.com", pending: true },
];

export function chainById(id: number): BridgeChain | undefined {
  return bridgeChains.find((c) => c.id === id);
}
