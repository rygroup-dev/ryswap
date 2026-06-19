import { useCallback, useEffect, useMemo, useState } from "react";
import { sourceChain, targetChain } from "../config/chains";

function getEthereum() {
  return window.ethereum;
}

export function useWallet() {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasWallet = Boolean(getEthereum());
  const onSourceChain = chainId === sourceChain.id;
  const onTargetChain = chainId === targetChain.id;

  const refreshWalletState = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    try {
      const [accounts, hexChainId] = await Promise.all([
        ethereum.request<string[]>({ method: "eth_accounts" }),
        ethereum.request<string>({ method: "eth_chainId" })
      ]);
      setAccount(accounts[0] || null);
      setChainId(hexChainId ? parseInt(hexChainId, 16) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read wallet state.");
    }
  }, []);

  useEffect(() => {
    void refreshWalletState();

    const ethereum = getEthereum();
    if (!ethereum?.on) return;

    const handleAccountsChanged = (accountsRaw: unknown) => {
      const accounts = Array.isArray(accountsRaw) ? (accountsRaw as string[]) : [];
      setAccount(accounts[0] || null);
    };

    const handleChainChanged = (hexChainIdRaw: unknown) => {
      if (typeof hexChainIdRaw !== "string") return;
      setChainId(parseInt(hexChainIdRaw, 16));
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [refreshWalletState]);

  const connect = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setError("No injected wallet found. Please open with MetaMask or Rabby.");
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      const accounts = await ethereum.request<string[]>({
        method: "eth_requestAccounts"
      });
      setAccount(accounts[0] || null);

      const hexChainId = await ethereum.request<string>({ method: "eth_chainId" });
      setChainId(hexChainId ? parseInt(hexChainId, 16) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    } finally {
      setIsConnecting(false);
    }
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
    const ethereum = getEthereum();
    if (!ethereum) {
      setError("No injected wallet found.");
      return;
    }

    setError(null);
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chain.hexChainId }]
      });
      setChainId(chain.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("4902") && chain.chainParams) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [chain.chainParams]
        });
        setChainId(chain.id);
        return;
      }
      setError(message || "Failed to switch chain.");
    }
  }, []);

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
      hasWallet,
      isConnecting,
      error,
      onSourceChain,
      onTargetChain,
      connect,
      switchChain,
      switchToSource,
      switchToTarget,
      refreshWalletState
    }),
    [
      account,
      chainId,
      hasWallet,
      isConnecting,
      error,
      onSourceChain,
      onTargetChain,
      connect,
      switchChain,
      switchToSource,
      switchToTarget,
      refreshWalletState
    ]
  );
}
