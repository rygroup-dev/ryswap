// Multi-chain swap configuration.
//
// ryswap runs the SAME non-custodial fee-swap flow on two chains:
//   - Ethereum mainnet (chainId 1)      -> LIVE, FeeRouter deployed + verified.
//   - Robinhood Chain  (chainId 4663)   -> staged; lights up once the 4663
//     FeeRouter is deployed and real v3 pools are wired into `tokens`.
//
// Each chain is described by a self-contained SwapChainConfig so the SwapPanel
// and the swap/quote hooks can be pointed at either chain without code changes.

export type SwapToken = {
  symbol: string;
  address: string;
  decimals: number;
  poolFee: number; // Uniswap v3 fee tier
};

export type SwapChainConfig = {
  key: "mainnet" | "robinhood";
  chainId: number;
  chainName: string;
  networkLabel: string; // shown in the panel header / "switch required" hints
  feeRouter: string; // "" until deployed on this chain
  swapRouter: string; // SwapRouter02-style router
  quoter: string; // QuoterV2; "" disables live quotes on this chain
  weth: string; // WETH9 the router wraps to
  feeBps: number;
  feeRecipient: string;
  tokens: SwapToken[];
  explorerName: string;
  explorerTxBase: string;
  explorerAddressBase: string;
};

// Whether a chain is ready for real swaps: needs a deployed FeeRouter and at
// least one wired output token. The UI uses this to gate the 4663 tab.
export function isSwapChainLive(c: SwapChainConfig): boolean {
  return Boolean(c.feeRouter) && c.tokens.length > 0;
}

// --------------------------------------------------------------- Ethereum (1)
// LIVE. FeeRouter is DEPLOYED and VERIFIED on mainnet. It skims a transparent
// platform fee, forwards the remainder to Uniswap SwapRouter02, and the router
// sends swap output directly to the user.
export const mainnetSwap: SwapChainConfig = {
  key: "mainnet",
  chainId: 1,
  chainName: "Ethereum",
  networkLabel: "Ethereum Mainnet",
  feeRouter:
    (import.meta.env.VITE_FEE_ROUTER as string) ||
    "0xB6bEB664d3888b8E59d816203e894012727Ea83A",
  swapRouter: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap SwapRouter02
  quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", // Uniswap QuoterV2
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  feeBps: Number(import.meta.env.VITE_FEE_BPS || 30),
  feeRecipient:
    (import.meta.env.VITE_FEE_RECIPIENT as string) ||
    "0x327F53A3D8fCb1d35fF549234a982D057aa1976C",
  tokens: [
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, poolFee: 500 },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, poolFee: 500 },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, poolFee: 500 },
    { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8, poolFee: 3000 },
    { symbol: "LINK", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18, poolFee: 3000 },
    { symbol: "UNI", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18, poolFee: 3000 },
    { symbol: "PEPE", address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", decimals: 18, poolFee: 3000 },
  ],
  explorerName: "Etherscan",
  explorerTxBase: "https://etherscan.io/tx/",
  explorerAddressBase: "https://etherscan.io/address/",
};

// ----------------------------------------------------------- Robinhood (4663)
// Staged. The swapRouter + WETH below are LIVE on 4663 (verified via eth_getCode).
// The FeeRouter must be deployed on 4663 (scripts/deploy.mjs) and its address set
// via VITE_FEE_ROUTER_4663. Output tokens must be discovered on-chain from the
// 4663 factory (0x1f7d7550B1b028f7571E69A784071F0205FD2EfA) before swaps work.
export const robinhoodSwap: SwapChainConfig = {
  key: "robinhood",
  chainId: Number(import.meta.env.VITE_TARGET_CHAIN_ID || 4663),
  chainName: "Robinhood Chain",
  networkLabel: `Robinhood Chain ${Number(import.meta.env.VITE_TARGET_CHAIN_ID || 4663)}`,
  feeRouter: (import.meta.env.VITE_FEE_ROUTER_4663 as string) || "",
  swapRouter:
    (import.meta.env.VITE_SWAP_ROUTER as string) ||
    "0xCaf681a66D020601342297493863E78C959E5cb2",
  quoter: (import.meta.env.VITE_SWAP_QUOTER_4663 as string) || "",
  weth:
    (import.meta.env.VITE_WETH_ADDRESS as string) ||
    "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  feeBps: Number(import.meta.env.VITE_FEE_BPS_4663 || 30),
  feeRecipient:
    (import.meta.env.VITE_FEE_RECIPIENT as string) ||
    "0x327F53A3D8fCb1d35fF549234a982D057aa1976C",
  // TODO(4663): populate from the 4663 factory once real v3 pools exist.
  // Left EMPTY on purpose — shipping addresses for pools that don't exist on
  // 4663 would point users at dead contracts and risk funds.
  tokens: [],
  explorerName: "Robinhood Explorer",
  explorerTxBase: "https://so-explorer.poptyedev.com/tx/",
  explorerAddressBase: "https://so-explorer.poptyedev.com/address/",
};

export const swapChains: SwapChainConfig[] = [mainnetSwap, robinhoodSwap];

// Back-compat default (mainnet) for any consumer not yet parameterized.
export const swapConfig = mainnetSwap;
export const swapTokens = mainnetSwap.tokens;
export const explorerTxBase = mainnetSwap.explorerTxBase;
