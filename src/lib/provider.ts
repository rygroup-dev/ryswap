// Multi-wallet provider discovery via EIP-6963.
//
// Instead of grabbing the single `window.ethereum` (which only ever exposes one
// wallet when several are installed), we listen for EIP-6963 announcements so
// MetaMask, OKX, Bitget, Rabby, Zerion, Coinbase, etc. all show up and the user
// can pick one. All hooks read the *selected* provider via getProvider().

export type EIP1193Provider = {
  request: <T = any>(args: { method: string; params?: any[] | object }) => Promise<T>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};

export type WalletInfo = {
  uuid: string;
  name: string;
  icon: string; // data URI
  rdns: string;
};

export type DiscoveredWallet = {
  info: WalletInfo;
  provider: EIP1193Provider;
};

const LEGACY_RDNS = "legacy.injected";
const STORAGE_KEY = "ryswap-selected-wallet";

const wallets = new Map<string, DiscoveredWallet>();
const listeners = new Set<() => void>();
let selectedRdns: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

// Cached snapshot for useSyncExternalStore: getSnapshot MUST return a stable
// reference between renders or React loops forever (blank screen). We only
// rebuild the array when `version` bumps (a wallet announces / selection changes).
let version = 0;
let cache: DiscoveredWallet[] = [];
let cacheVersion = -1;

function emit() {
  version++;
  for (const l of listeners) l();
}

function legacyInjected(): EIP1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
}

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (event: Event) => {
    const detail = (event as CustomEvent<DiscoveredWallet>).detail;
    if (detail?.info?.rdns && detail.provider) {
      wallets.set(detail.info.rdns, detail);
      emit();
    }
  });
  // Ask any installed wallets to (re-)announce themselves.
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

// All discovered wallets, plus a legacy fallback entry if a wallet only injects
// the old window.ethereum and never announced via EIP-6963.
export function listWallets(): DiscoveredWallet[] {
  if (cacheVersion === version) return cache;
  const list = [...wallets.values()];
  const legacy = legacyInjected();
  if (legacy && !list.some((w) => w.provider === legacy)) {
    list.push({
      info: { uuid: LEGACY_RDNS, name: "Injected wallet", icon: "", rdns: LEGACY_RDNS },
      provider: legacy,
    });
  }
  cache = list;
  cacheVersion = version;
  return cache;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function selectWallet(rdns: string) {
  selectedRdns = rdns;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, rdns);
  emit();
}

export function getSelectedRdns(): string | null {
  return selectedRdns;
}

// The provider every hook should use. Falls back to a single discovered wallet,
// then to legacy window.ethereum, so existing single-wallet setups keep working.
export function getProvider(): EIP1193Provider | undefined {
  if (selectedRdns) {
    if (wallets.has(selectedRdns)) return wallets.get(selectedRdns)!.provider;
    if (selectedRdns === LEGACY_RDNS) return legacyInjected();
  }
  const list = listWallets();
  if (list.length === 1) return list[0].provider;
  return legacyInjected();
}

export function hasAnyWallet(): boolean {
  return listWallets().length > 0;
}
