// Live mainnet swap configuration.
// FeeRouter is DEPLOYED and VERIFIED on Ethereum mainnet (chainId 1).
// It skims a transparent platform fee, forwards the remainder to Uniswap
// SwapRouter02, and sends swap output directly to the user.

export const swapConfig = {
  chainId: 1,
  chainName: "Ethereum",
  // Live FeeRouter (deployed + ownership secured to clean wallet).
  feeRouter:
    (import.meta.env.VITE_FEE_ROUTER as string) ||
    "0xB6bEB664d3888b8E59d816203e894012727Ea83A",
  // Uniswap SwapRouter02 (canonical mainnet).
  swapRouter: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  feeBps: Number(import.meta.env.VITE_FEE_BPS || 30),
  feeRecipient:
    (import.meta.env.VITE_FEE_RECIPIENT as string) ||
    "0x327F53A3D8fCb1d35fF549234a982D057aa1976C",
  weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
} as const;

// Supported output tokens for ETH -> token swaps (Uniswap v3 pools).
export type SwapToken = {
  symbol: string;
  address: string;
  decimals: number;
  poolFee: number; // Uniswap v3 fee tier
};

export const swapTokens: SwapToken[] = [
  {
    symbol: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    poolFee: 500,
  },
  {
    symbol: "USDT",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    poolFee: 500,
  },
  {
    symbol: "DAI",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    poolFee: 500,
  },
  {
    symbol: "WBTC",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    poolFee: 3000,
  },
  {
    symbol: "LINK",
    address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    decimals: 18,
    poolFee: 3000,
  },
  {
    symbol: "UNI",
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    decimals: 18,
    poolFee: 3000,
  },
  {
    symbol: "PEPE",
    address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    decimals: 18,
    poolFee: 3000,
  },
];

export const explorerTxBase = "https://etherscan.io/tx/";
