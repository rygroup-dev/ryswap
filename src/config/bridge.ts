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

const liveChains = [
  { id: 1, name: "Ethereum", short: "ETH", rpc: "https://ethereum.publicnode.com", explorer: "https://etherscan.io" },
  { id: 10, name: "Optimism", short: "ETH", rpc: "https://optimism.publicnode.com", explorer: "https://optimistic.etherscan.io" },
  { id: 25, name: "Cronos", short: "CRO", rpc: "https://cronos.drpc.org", explorer: "https://cronoscan.com" },
  { id: 56, name: "BNB Chain", short: "BNB", rpc: "https://bsc-rpc.publicnode.com", explorer: "https://bscscan.com" },
  { id: 100, name: "Gnosis", short: "xDAI", rpc: "https://rpc.gnosischain.com/", explorer: "https://gnosisscan.io" },
  { id: 130, name: "Unichain", short: "ETH", rpc: "https://mainnet.unichain.org", explorer: "https://uniscan.xyz" },
  { id: 143, name: "Monad", short: "MON", rpc: "https://rpc3.monad.xyz", explorer: "https://monadvision.com" },
  { id: 169, name: "Manta Pacific", short: "ETH", rpc: "https://pacific-rpc.manta.network/http", explorer: "https://pacific-explorer.manta.network" },
  { id: 288, name: "Boba", short: "ETH", rpc: "https://mainnet.boba.network", explorer: "https://bobascan.com" },
  { id: 324, name: "zkSync Era", short: "ETH", rpc: "https://mainnet.era.zksync.io", explorer: "https://explorer.zksync.io" },
  { id: 360, name: "Shape", short: "ETH", rpc: "https://mainnet.shape.network", explorer: "https://shapescan.xyz" },
  { id: 480, name: "World Chain", short: "ETH", rpc: "https://worldchain-mainnet.gateway.tenderly.co", explorer: "https://worldscan.org" },
  { id: 747, name: "Flow EVM", short: "FLOW", rpc: "https://mainnet.evm.nodes.onflow.org", explorer: "https://evm.flowscan.io" },
  { id: 999, name: "HyperEVM", short: "HYPE", rpc: "https://rpc.hyperliquid.xyz/evm", explorer: "https://hyperevmscan.io" },
  { id: 1135, name: "Lisk", short: "ETH", rpc: "https://rpc.api.lisk.com", explorer: "https://blockscout.lisk.com" },
  { id: 1868, name: "Soneium", short: "ETH", rpc: "https://rpc.soneium.org/", explorer: "https://soneium.blockscout.com" },
  { id: 1923, name: "SwellChain", short: "ETH", rpc: "https://swell-mainnet.alt.technology", explorer: "https://explorer.swellnetwork.io" },
  { id: 2020, name: "Ronin", short: "RON", rpc: "https://api.roninchain.com/rpc", explorer: "https://explorer.roninchain.com" },
  { id: 2741, name: "Abstract", short: "ETH", rpc: "https://api.mainnet.abs.xyz", explorer: "https://abscan.org" },
  { id: 2818, name: "Morph", short: "ETH", rpc: "https://rpc-quicknode.morphl2.io", explorer: "https://explorer.morphl2.io" },
  { id: 4326, name: "MegaETH", short: "ETH", rpc: "https://mainnet.megaeth.com/rpc", explorer: "https://megaeth.blockscout.com" },
  { id: 5031, name: "Somnia", short: "SOMI", rpc: "https://api.infra.mainnet.somnia.network", explorer: "https://explorer.somnia.network" },
  { id: 5330, name: "Superseed", short: "ETH", rpc: "https://mainnet.superseed.xyz", explorer: "https://explorer.superseed.xyz" },
  { id: 7560, name: "Cyber", short: "ETH", rpc: "https://cyber.alt.technology/", explorer: "https://cyberscan.co" },
  { id: 8333, name: "B3", short: "ETH", rpc: "https://mainnet-rpc.b3.fun/http", explorer: "https://explorer.b3.fun" },
  { id: 8453, name: "Base", short: "ETH", rpc: "https://base.drpc.org", explorer: "https://basescan.org" },
  { id: 9745, name: "Plasma", short: "XPL", rpc: "https://rpc.plasma.to", explorer: "https://plasmascan.to" },
  { id: 33139, name: "ApeChain", short: "APE", rpc: "https://apechain.calderachain.xyz/http", explorer: "https://apescan.io" },
  { id: 34443, name: "Mode", short: "ETH", rpc: "https://mainnet.mode.network/", explorer: "https://explorer.mode.network" },
  { id: 42018, name: "Mythos", short: "ETH", rpc: "https://mythos-mainnet.g.alchemy.com/public/", explorer: "https://mythos-mainnet.explorer.alchemy.com" },
  { id: 42161, name: "Arbitrum", short: "ETH", rpc: "https://arbitrum-one.publicnode.com", explorer: "https://arbiscan.io" },
  { id: 42170, name: "Arbitrum Nova", short: "ETH", rpc: "https://arbitrum-nova.publicnode.com", explorer: "https://nova.arbiscan.io" },
  { id: 43111, name: "Hemi", short: "ETH", rpc: "https://rpc.hemi.network/rpc", explorer: "https://explorer.hemi.xyz" },
  { id: 43419, name: "Gunz", short: "GUN", rpc: "https://subnets.avax.network/gunzilla/mainnet/rpc", explorer: "https://gunzscan.io" },
  { id: 48900, name: "Zircuit", short: "ETH", rpc: "https://mainnet.zircuit.com", explorer: "https://explorer.zircuit.com" },
  { id: 55244, name: "Superposition", short: "ETH", rpc: "https://rpc.superposition.so", explorer: "https://explorer.superposition.so" },
  { id: 57073, name: "Ink", short: "ETH", rpc: "https://ink.drpc.org", explorer: "https://explorer.inkonchain.com" },
  { id: 59144, name: "Linea", short: "ETH", rpc: "https://rpc.linea.build", explorer: "https://lineascan.build" },
  { id: 60808, name: "BOB", short: "ETH", rpc: "https://rpc.gobob.xyz/", explorer: "https://explorer.gobob.xyz" },
  { id: 69000, name: "Animechain", short: "ANIME", rpc: "https://public-rpc.anime.xyz/", explorer: "https://explorer-animechain-39xf6m45e3.t.conduit.xyz" },
  { id: 81457, name: "Blast", short: "ETH", rpc: "https://rpc.blast.io/", explorer: "https://blastscan.io" },
  { id: 97477, name: "Doma", short: "ETH", rpc: "https://doma.drpc.org", explorer: "https://explorer.doma.xyz" },
  { id: 98866, name: "Plume", short: "PLUME", rpc: "https://rpc.plume.org", explorer: "https://explorer.plume.org" },
  { id: 167000, name: "Taiko", short: "ETH", rpc: "https://rpc.mainnet.taiko.xyz", explorer: "https://taikoscan.io" },
  { id: 534352, name: "Scroll", short: "ETH", rpc: "https://rpc.scroll.io/", explorer: "https://scrollscan.com" },
  { id: 685689, name: "Gensyn", short: "ETH", rpc: "https://gensyn-mainnet.g.alchemy.com/public", explorer: "https://gensyn-mainnet.explorer.alchemy.com" },
  { id: 747474, name: "Katana", short: "ETH", rpc: "https://rpc.katana.network", explorer: "https://explorer.katanarpc.com" },
  { id: 5064014, name: "Ethereal", short: "USDe", rpc: "https://rpc.ethereal.trade", explorer: "https://explorer.ethereal.trade" },
  { id: 7777777, name: "Zora", short: "ETH", rpc: "https://rpc.zora.energy", explorer: "https://explorer.zora.energy" },
  { id: 666666666, name: "Degen", short: "DEGEN", rpc: "https://rpc.degen.tips", explorer: "https://explorer.degen.tips" },
  { id: 888888888, name: "Ancient8", short: "ETH", rpc: "https://rpc.ancient8.gg/", explorer: "https://scan.ancient8.gg" },
  { id: 1380012617, name: "RARI", short: "ETH", rpc: "https://mainnet.rpc.rarichain.org/http", explorer: "https://mainnet.explorer.rarichain.org" },
] as const;

// Chains verified live on Relay as of 2026-06-19 (Relay /chains API) + Robinhood Chain pending.
export const bridgeChains: BridgeChain[] = [
  ...liveChains.map((chain) => ({
    ...chain,
    hex: `0x${chain.id.toString(16)}`,
  })),
  // Robinhood Chain — not yet on Relay. Auto-enables when Relay lists it.
  {
    id: 4663,
    name: "Robinhood Chain",
    short: "RH",
    hex: "0x1237",
    rpc: "https://poptye-always-win.poptyedev.com",
    explorer: "https://so-explorer.poptyedev.com",
    pending: true,
  },
];

export function chainById(id: number): BridgeChain | undefined {
  return bridgeChains.find((c) => c.id === id);
}
