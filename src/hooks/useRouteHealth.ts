import { useEffect, useState } from "react";
import { targetChain } from "../config/chains";

export type RouteHealth = {
  chainReachable: boolean;
  blockNumber: number | null;
  message: string;
  status: "checking" | "healthy" | "degraded";
};

async function rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(targetChain.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result as T;
}

export function useRouteHealth() {
  const [state, setState] = useState<RouteHealth>({
    chainReachable: false,
    blockNumber: null,
    message: "Checking Robinhood 4663 route health...",
    status: "checking"
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [hexChainId, hexBlockNumber] = await Promise.all([
          rpcCall<string>("eth_chainId"),
          rpcCall<string>("eth_blockNumber")
        ]);

        if (cancelled) return;
        const chainId = parseInt(hexChainId, 16);
        const blockNumber = parseInt(hexBlockNumber, 16);

        if (chainId !== targetChain.id) {
          setState({
            chainReachable: false,
            blockNumber,
            message: `RPC responded with chain ${chainId}, expected ${targetChain.id}.`,
            status: "degraded"
          });
          return;
        }

        setState({
          chainReachable: true,
          blockNumber,
          message: "Robinhood 4663 RPC is live and responding.",
          status: "healthy"
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          chainReachable: false,
          blockNumber: null,
          message:
            err instanceof Error ? err.message : "Failed to reach Robinhood 4663 RPC.",
          status: "degraded"
        });
      }
    }

    void load();
    const timer = window.setInterval(load, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return state;
}
