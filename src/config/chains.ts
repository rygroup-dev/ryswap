export const sourceChain = {
  id: Number(import.meta.env.VITE_SOURCE_CHAIN_ID || 1),
  name: "Ethereum",
  symbol: "ETH",
  hexChainId: `0x${Number(import.meta.env.VITE_SOURCE_CHAIN_ID || 1).toString(16)}`
};

export const targetChain = {
  id: Number(import.meta.env.VITE_TARGET_CHAIN_ID || 4663),
  name: "Robinhood Chain",
  symbol: "rbETH",
  nativeSymbol: "ETH",
  rpcUrl:
    import.meta.env.VITE_TARGET_CHAIN_RPC ||
    "https://poptye-always-win.poptyedev.com",
  explorerUrl:
    import.meta.env.VITE_TARGET_CHAIN_EXPLORER ||
    "https://so-explorer.poptyedev.com",
  hexChainId: `0x${Number(import.meta.env.VITE_TARGET_CHAIN_ID || 4663).toString(16)}`,
  chainParams: {
    chainId: `0x${Number(import.meta.env.VITE_TARGET_CHAIN_ID || 4663).toString(16)}`,
    chainName: "Robinhood Chain",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: [
      import.meta.env.VITE_TARGET_CHAIN_RPC ||
        "https://poptye-always-win.poptyedev.com"
    ],
    blockExplorerUrls: [
      import.meta.env.VITE_TARGET_CHAIN_EXPLORER ||
        "https://so-explorer.poptyedev.com"
    ]
  }
};

export const assetConfig = {
  rbEthAddress:
    import.meta.env.VITE_RBETH_ADDRESS ||
    "0x9c497572F6Ab96Cb6859EcDb0FBAD87F852c8F35",
  wethAddress:
    import.meta.env.VITE_WETH_ADDRESS ||
    "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73"
};
