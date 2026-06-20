export const DIRECT_BRIDGE_SOURCE_CHAIN_ID = Number(
  import.meta.env.VITE_DIRECT_BRIDGE_SOURCE_CHAIN_ID || 1
);

export const DIRECT_BRIDGE_FEE_BPS = Number(
  import.meta.env.VITE_DIRECT_BRIDGE_FEE_BPS || 150
);

export const DIRECT_BRIDGE_FEE_RECIPIENT =
  (import.meta.env.VITE_DIRECT_BRIDGE_FEE_RECIPIENT as string) ||
  "0x327F53A3D8fCb1d35fF549234a982D057aa1976C";

export const DIRECT_BRIDGE_INBOX =
  (import.meta.env.VITE_DIRECT_BRIDGE_INBOX as string) ||
  "0x1A07a4D49f341aA8A8f6B3A6d3367ec681f81044";

export const DIRECT_BRIDGE_FEE_ROUTER =
  (import.meta.env.VITE_DIRECT_BRIDGE_FEE_ROUTER as string) ||
  "";

export const directBridgeConfig = {
  sourceChainId: DIRECT_BRIDGE_SOURCE_CHAIN_ID,
  feeBps: DIRECT_BRIDGE_FEE_BPS,
  feeRecipient: DIRECT_BRIDGE_FEE_RECIPIENT,
  inbox: DIRECT_BRIDGE_INBOX,
  feeRouter: DIRECT_BRIDGE_FEE_ROUTER,
  readyForPublicUse: false,
  activationBlocker:
    "Pending Robinhood allowlist / public Inbox access. Single-tx wrapper is scaffolded but should stay disabled until explicitly whitelisted.",
};
