import { useEffect, useRef, useState } from "react";
import type { SwapChainConfig, SwapToken } from "../config/swap";

function pad(hex: string): string {
  return hex.replace(/^0x/, "").padStart(64, "0");
}
function addr(a: string): string {
  return pad(a.toLowerCase());
}
function uint(n: bigint): string {
  return pad(n.toString(16));
}

// quoteExactInputSingle((tokenIn,tokenOut,amountIn,fee,sqrtPriceLimitX96))
function encodeQuote(amountIn: bigint, weth: string, token: SwapToken): string {
  return (
    "0xc6a5026a" +
    addr(weth) +
    addr(token.address) +
    uint(amountIn) +
    pad(token.poolFee.toString(16)) +
    uint(0n)
  );
}

export type QuoteState = {
  loading: boolean;
  amountOut: bigint | null; // raw token units
  error: string | null;
};

// Reads a live quote via eth_call against the chain's QuoterV2 using the user's
// injected RPC. Quoter + WETH come from the active SwapChainConfig, so the same
// hook serves both mainnet and Robinhood Chain (4663).
export function useQuote(
  forwardWei: bigint,
  token: SwapToken | null,
  config: SwapChainConfig
): QuoteState {
  const [state, setState] = useState<QuoteState>({
    loading: false,
    amountOut: null,
    error: null,
  });
  const reqId = useRef(0);

  useEffect(() => {
    const eth = (window as unknown as { ethereum?: any }).ethereum;
    // No wallet, no quoter on this chain, no token, or no input -> no quote.
    if (!eth || !config.quoter || !token || forwardWei <= 0n) {
      setState({ loading: false, amountOut: null, error: null });
      return;
    }
    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    const data = encodeQuote(forwardWei, config.weth, token);
    eth
      .request({
        method: "eth_call",
        params: [{ to: config.quoter, data }, "latest"],
      })
      .then((ret: string) => {
        if (id !== reqId.current) return; // stale
        // First 32 bytes of return = amountOut.
        const hex = ret.replace(/^0x/, "");
        if (hex.length < 64) {
          setState({ loading: false, amountOut: null, error: "Empty quote" });
          return;
        }
        const amountOut = BigInt("0x" + hex.slice(0, 64));
        setState({ loading: false, amountOut, error: null });
      })
      .catch((e: any) => {
        if (id !== reqId.current) return;
        setState({
          loading: false,
          amountOut: null,
          error: e?.message || "Quote failed",
        });
      });
  }, [forwardWei, token, config]);

  return state;
}
