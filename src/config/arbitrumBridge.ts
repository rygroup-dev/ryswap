// Robinhood Chain (4663) Arbitrum native bridge contracts on Ethereum L1.
// Discovered via on-chain reverse engineering of the Orbit deployment.
// Users call Inbox.depositEth() on Ethereum → native ETH arrives on Robinhood Chain.

export const arbitrumBridge = {
  l1ChainId: 1,
  l2ChainId: 4663,
  inbox: "0x1A07cc4BD17E0118BdB54D70990D2158AbAD7a2D",
  bridge: "0xDf8755334Ce7a73cCF6B581c02Ea649AE3e864B3",
  sequencerInbox: "0xBd0d173EEB87D57A09521c24388a12789F33Ba96",
  rollup: "0x23a19d23E89166AdEdbDcb432518ab01e4272D94",
  l1Rpc: "https://ethereum-rpc.publicnode.com",
  l2Rpc: "https://poptye-always-win.poptyedev.com",
  l2Explorer: "https://so-explorer.poptyedev.com",
  l1Explorer: "https://etherscan.io",
  // depositEth() selector — the simplest bridge path
  depositEthSelector: "0x439370b1",
  // createRetryableTicket(address,uint256,uint256,address,address,uint256,uint256,bytes)
  createRetryableTicketSelector: "0x679b6ded",
} as const;

// Estimated bridge time: retryable ticket settles in ~10-15 minutes.
// Direct depositEth may take longer (up to challenge period for full finality,
// but usable balance appears within ~10-15 min).
export const BRIDGE_ETA_SECONDS = 900;
