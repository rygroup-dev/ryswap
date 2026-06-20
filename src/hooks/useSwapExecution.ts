import { useCallback, useMemo, useState } from "react";
import type { SwapChainConfig, SwapToken } from "../config/swap";

// Minimal ABI encoding helpers for exactInputSingle + routeSwap, done by hand to
// avoid pulling a full web3 lib into the bundle. We only need a couple of selectors.

function selector(sig: string): string {
  // keccak256 selectors are precomputed (stable) to avoid bundling a hash lib.
  // exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))
  // routeSwap(bytes)
  const known: Record<string, string> = {
    "exactInputSingle": "0x04e45aaf",
    "routeSwap": "0xec05157a",
  };
  return known[sig];
}

function pad(hex: string): string {
  return hex.replace(/^0x/, "").padStart(64, "0");
}

function addr(a: string): string {
  return pad(a.toLowerCase());
}

function uint(n: bigint): string {
  return pad(n.toString(16));
}

// Encode SwapRouter02.exactInputSingle(params) where output recipient = user.
function encodeExactInputSingle(params: {
  tokenIn: string;
  tokenOut: string;
  fee: number;
  recipient: string;
  amountIn: bigint;
  amountOutMinimum: bigint;
}): string {
  const sel = selector("exactInputSingle");
  const body =
    addr(params.tokenIn) +
    addr(params.tokenOut) +
    pad(params.fee.toString(16)) +
    addr(params.recipient) +
    uint(params.amountIn) +
    uint(params.amountOutMinimum) +
    uint(0n); // sqrtPriceLimitX96
  return sel + body;
}

// Encode FeeRouter.routeSwap(bytes routerCalldata) — dynamic bytes arg.
function encodeRouteSwap(routerCalldata: string): string {
  const sel = selector("routeSwap");
  const raw = routerCalldata.replace(/^0x/, "");
  const byteLen = raw.length / 2;
  const offset = uint(32n); // single dynamic param at 0x20
  const len = uint(BigInt(byteLen));
  const padded = raw.padEnd(Math.ceil(raw.length / 64) * 64, "0");
  return sel + offset + len + padded;
}

type SwapState =
  | { status: "idle" }
  | { status: "pending"; hash?: string }
  | { status: "success"; hash: string }
  | { status: "error"; message: string };

export function useSwapExecution(
  account: string | null,
  amountEth: string,
  token: SwapToken | null,
  amountOutMinimum: bigint = 0n,
  config: SwapChainConfig
) {
  const [state, setState] = useState<SwapState>({ status: "idle" });

  const split = useMemo(() => {
    let total = 0n;
    try {
      const v = Number(amountEth);
      if (Number.isFinite(v) && v > 0) {
        total = BigInt(Math.round(v * 1e18));
      }
    } catch {
      total = 0n;
    }
    const fee = (total * BigInt(config.feeBps)) / 10000n;
    const forward = total - fee;
    return { total, fee, forward };
  }, [amountEth, config]);

  const execute = useCallback(async () => {
    const eth = (window as unknown as { ethereum?: any }).ethereum;
    if (!eth) {
      setState({ status: "error", message: "No injected wallet found." });
      return;
    }
    if (!account) {
      setState({ status: "error", message: "Connect wallet first." });
      return;
    }
    if (split.total <= 0n) {
      setState({ status: "error", message: "Enter a valid amount." });
      return;
    }
    if (!token) {
      setState({ status: "error", message: "Select an output token." });
      return;
    }
    if (!config.feeRouter) {
      setState({
        status: "error",
        message: `FeeRouter is not deployed on ${config.chainName} yet.`,
      });
      return;
    }

    try {
      setState({ status: "pending" });

      const routerCalldata = encodeExactInputSingle({
        tokenIn: config.weth,
        tokenOut: token.address,
        fee: token.poolFee,
        recipient: account, // output goes straight to the user
        amountIn: split.forward,
        amountOutMinimum, // slippage-protected minimum from live quote
      });
      const data = encodeRouteSwap(routerCalldata);

      const txParams = {
        from: account,
        to: config.feeRouter,
        value: "0x" + split.total.toString(16),
        data,
      };

      const hash: string = await eth.request({
        method: "eth_sendTransaction",
        params: [txParams],
      });
      setState({ status: "pending", hash });

      // Poll for receipt.
      let receipt: any = null;
      for (let i = 0; i < 60; i++) {
        receipt = await eth.request({
          method: "eth_getTransactionReceipt",
          params: [hash],
        });
        if (receipt) break;
        await new Promise((r) => setTimeout(r, 3000));
      }

      if (receipt && receipt.status === "0x1") {
        setState({ status: "success", hash });
      } else if (receipt) {
        setState({ status: "error", message: `Transaction reverted (${hash}).` });
      } else {
        setState({ status: "pending", hash });
      }
    } catch (err: any) {
      setState({
        status: "error",
        message: err?.message || "Swap failed.",
      });
    }
  }, [account, split, token, amountOutMinimum, config]);

  return {
    state,
    split,
    explorerUrl: (h: string) => config.explorerTxBase + h,
    execute,
    reset: () => setState({ status: "idle" }),
  };
}
