import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { sourceChain, targetChain } from "../config/chains";
import { chainById } from "../config/bridge";
import {
  getProvider,
  getSelectedRdns,
  listWallets,
  selectWallet as selectWalletStore,
  subscribe,
  type DiscoveredWallet,
} from "../lib/provider";

function formatNativeBalance(raw: bigint): string {
  const whole = raw / 10n ** 18n;
  const fraction = raw % 10n ** 18n;
  const fractionText = fraction.toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
}

export function useWallet() {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [nativeBalance, setNativeBalance] = useState<bigint | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-render when the set of discovered wallets / selection changes (EIP-6963).
  const wallets = useSyncExternalStore<DiscoveredWallet[]>(
    subscribe,
    listWallets,
    () => []
  );
  const selectedRdns = useSyncExternalStore(subscribe, getSelectedRdns, () => null);

  const hasWallet = wallets.length > 0;
  const onSourceChain = chainId === sourceChain.id;
  const onTargetChain = chainId === targetChain.id;
  const activeChain = chainId != null ? chainById(chainId) : undefined;
  const chainName = activeChain?.name || (chainId === targetChain.id ? targetChain.name : null);
  const nativeSymbol = activeChain?.short || (chainId === sourceChain.id ? sourceChain.symbol : targetChain.nativeSymbol);

  const refreshBalance = useCallback(
    async (nextAccount?: string | null) => {
      const ethereum = getProvider();
      const address = nextAccount ?? account;
      if (!ethereum || !address) {
        setNativeBalance(null);
        setIsBalanceLoading(false);
        return;
      }

      setIsBalanceLoading(true);
      try {
        const hexBalance = await ethereum.request<string>({
          method: "eth_getBalance",
          params: [address, "latest"],
        });
        setNativeBalance(hexBalance ? BigInt(hexBalance) : 0n);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to read wallet balance.");
      } finally {
        setIsBalanceLoading(false);
      }
    },
    [account]
  );

  const refreshWalletState = useCallback(async () => {
    const ethereum = getProvider();
    if (!ethereum) return;

    try {
      const [accounts, hexChainId] = await Promise.all([
        ethereum.request<string[]>({ method: "eth_accounts" }),
        ethereum.request<string>({ method: "eth_chainId" })
      ]);
      const nextAccount = accounts[0] || null;
      setAccount(nextAccount);
      setChainId(hexChainId ? parseInt(hexChainId, 16) : null);
      await refreshBalance(nextAccount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read wallet state.");
    }
  }, [refreshBalance]);

  // Re-sync + (re)attach events whenever the selected provider changes.
  useEffect(() => {
    void refreshWalletState();

    const ethereum = getProvider();
    if (!ethereum?.on) return;

    const handleAccountsChanged = (accountsRaw: unknown) => {
      const accounts = Array.isArray(accountsRaw) ? (accountsRaw as string[]) : [];
      const nextAccount = accounts[0] || null;
      setAccount(nextAccount);
      void refreshBalance(nextAccount);
    };

    const handleChainChanged = (hexChainIdRaw: unknown) => {
      if (typeof hexChainIdRaw !== "string") return;
      setChainId(parseInt(hexChainIdRaw, 16));
      void refreshBalance();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [refreshBalance, refreshWalletState, selectedRdns]);

  // Connect to a specific wallet (by EIP-6963 rdns) or the current default.
  const connect = useCallback(async (rdns?: string) => {
    if (rdns) selectWalletStore(rdns);
    const ethereum = getProvider();
    if (!ethereum) {
      setError("No wallet found. Install MetaMask, OKX, Bitget, Rabby, or Zerion.");
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      const accounts = await ethereum.request<string[]>({
        method: "eth_requestAccounts"
      });
      const nextAccount = accounts[0] || null;
      setAccount(nextAccount);

      const hexChainId = await ethereum.request<string>({ method: "eth_chainId" });
      setChainId(hexChainId ? parseInt(hexChainId, 16) : null);
      await refreshBalance(nextAccount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    } finally {
      setIsConnecting(false);
    }
  }, [refreshBalance]);

  const selectWallet = useCallback((rdns: string) => {
    selectWalletStore(rdns);
  }, []);

  const switchChain = useCallback(async (chain: {
    id: number;
    hexChainId: string;
    chainParams?: {
      chainId: string;
      chainName: string;
      nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
      };
      rpcUrls: string[];
      blockExplorerUrls: string[];
    };
  }) => {
    const ethereum = getProvider();
    if (!ethereum) {
      setError("No wallet found.");
      return;
    }

    setError(null);
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chain.hexChainId }]
      });
      setChainId(chain.id);
      await refreshBalance();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("4902") && chain.chainParams) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [chain.chainParams]
        });
        setChainId(chain.id);
        await refreshBalance();
        return;
      }
      setError(message || "Failed to switch chain.");
    }
  }, [refreshBalance]);

  const switchToSource = useCallback(async () => {
    await switchChain(sourceChain);
  }, [switchChain]);

  const switchToTarget = useCallback(async () => {
    await switchChain(targetChain);
  }, [switchChain]);

  return useMemo(
    () => ({
      account,
      chainId,
      nativeBalance,
      nativeBalanceFormatted: nativeBalance != null ? formatNativeBalance(nativeBalance) : null,
      nativeSymbol,
      chainName,
      isBalanceLoading,
      hasWallet,
      wallets,
      selectedRdns,
      selectWallet,
      isConnecting,
      error,
      onSourceChain,
      onTargetChain,
      connect,
      switchChain,
      switchToSource,
      switchToTarget,
      refreshWalletState,
      refreshBalance,
    }),
    [
      account,
      chainId,
      nativeBalance,
      nativeSymbol,
      chainName,
      isBalanceLoading,
      hasWallet,
      wallets,
      selectedRdns,
      selectWallet,
      isConnecting,
      error,
      onSourceChain,
      onTargetChain,
      connect,
      switchChain,
      switchToSource,
      switchToTarget,
      refreshWalletState,
      refreshBalance,
    ]
  );
}
