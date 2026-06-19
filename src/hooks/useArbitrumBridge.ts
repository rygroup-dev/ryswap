import { useCallback, useEffect, useRef, useState } from "react";
import { arbitrumBridge, BRIDGE_ETA_SECONDS } from "../config/arbitrumBridge";
import { formatWeiToEth, parseEthToWei, applyBps } from "../lib/evm";
import { feeConfig } from "../config/fees";

// ── ABI encoding helpers (no external deps) ─────────────────────────────────

function pad(hex: string): string {
  return hex.replace(/^0x/, "").padStart(64, "0");
}
function addr(a: string): string {
  return pad(a.toLowerCase());
}
function uint(n: bigint): string {
  return pad(n.toString(16));
}

// Encode depositEth() — simplest path, just sends value
function encodeDepositEth(): string {
  return arbitrumBridge.depositEthSelector;
}

// Encode createRetryableTicket for more control over gas params
function encodeCreateRetryableTicket(params: {
  to: string;
  l2CallValue: bigint;
  maxSubmissionCost: bigint;
  excessFeeRefundAddress: string;
  callValueRefundAddress: string;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  data: string;
}): string {
  const dataBytes = params.data.replace(/^0x/, "");
  const dataLen = dataBytes.length / 2;
  const dataPadded = dataBytes.padEnd(Math.ceil(dataBytes.length / 64) * 64, "0");

  return (
    arbitrumBridge.createRetryableTicketSelector +
    addr(params.to) +
    uint(params.l2CallValue) +
    uint(params.maxSubmissionCost) +
    addr(params.excessFeeRefundAddress) +
    addr(params.callValueRefundAddress) +
    uint(params.gasLimit) +
    uint(params.maxFeePerGas) +
    uint(256n) + // offset to data bytes
    uint(BigInt(dataLen)) +
    dataPadded
  );
}

// ── Quote ───────────────────────────────────────────────────────────────────

export type NativeBridgeQuote = {
  grossWei: bigint;
  feeWei: bigint;
  netBridgeWei: bigint;
  grossFormatted: string;
  feeFormatted: string;
  netFormatted: string;
  etaSeconds: number;
  method: "depositEth" | "createRetryableTicket";
};

export function useNativeBridgeQuote(amountEth: string): {
  loading: boolean;
  quote: NativeBridgeQuote | null;
  error: string | null;
} {
  const [state, setState] = useState<{
    loading: boolean;
    quote: NativeBridgeQuote | null;
    error: string | null;
  }>({ loading: false, quote: null, error: null });

  useEffect(() => {
    try {
      const grossWei = parseEthToWei(amountEth);
      if (grossWei <= 0n) {
        setState({ loading: false, quote: null, error: null });
        return;
      }

      const feeWei = applyBps(grossWei, feeConfig.bps);
      const netBridgeWei = grossWei - feeWei;

      if (netBridgeWei <= 0n) {
        setState({
          loading: false,
          quote: null,
          error: "Amount too small after fee.",
        });
        return;
      }

      setState({
        loading: false,
        quote: {
          grossWei,
          feeWei,
          netBridgeWei,
          grossFormatted: formatWeiToEth(grossWei),
          feeFormatted: formatWeiToEth(feeWei),
          netFormatted: formatWeiToEth(netBridgeWei),
          etaSeconds: BRIDGE_ETA_SECONDS,
          method: "depositEth",
        },
        error: null,
      });
    } catch {
      setState({ loading: false, quote: null, error: "Invalid amount." });
    }
  }, [amountEth]);

  return state;
}

// ── Execution ───────────────────────────────────────────────────────────────

type BridgeState =
  | { status: "idle" }
  | { status: "switching" }
  | { status: "sending-fee" }
  | { status: "depositing"; feeHash?: string }
  | { status: "waiting"; depositHash: string }
  | { status: "success"; depositHash: string; feeHash?: string }
  | { status: "error"; message: string };

export function useArbitrumBridgeExecution() {
  const [state, setState] = useState<BridgeState>({ status: "idle" });
  const cancelledRef = useRef(false);

  const execute = useCallback(
    async (account: string, quote: NativeBridgeQuote) => {
      const eth = window.ethereum;
      if (!eth) {
        setState({ status: "error", message: "No wallet found." });
        return;
      }

      cancelledRef.current = false;

      try {
        // 1. Ensure wallet is on Ethereum mainnet
        setState({ status: "switching" });
        const currentChain: string = await eth.request({
          method: "eth_chainId",
        });
        if (parseInt(currentChain, 16) !== 1) {
          try {
            await eth.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x1" }],
            });
          } catch (err: any) {
            setState({
              status: "error",
              message: "Switch wallet to Ethereum Mainnet to bridge.",
            });
            return;
          }
        }

        if (cancelledRef.current) return;

        // 2. Send platform fee (separate tx for transparency)
        let feeHash: string | undefined;
        if (quote.feeWei > 0n && feeConfig.recipient !== "0x0000000000000000000000000000000000000000") {
          setState({ status: "sending-fee" });
          feeHash = await eth.request<string>({
            method: "eth_sendTransaction",
            params: [
              {
                from: account,
                to: feeConfig.recipient,
                value: "0x" + quote.feeWei.toString(16),
              },
            ],
          });

          if (cancelledRef.current) return;

          // Wait for fee tx confirmation
          for (let i = 0; i < 30; i++) {
            const receipt = await eth.request<any>({
              method: "eth_getTransactionReceipt",
              params: [feeHash],
            });
            if (receipt) {
              if (receipt.status !== "0x1") {
                setState({ status: "error", message: "Fee transfer failed." });
                return;
              }
              break;
            }
            await new Promise((r) => setTimeout(r, 3000));
          }
        }

        if (cancelledRef.current) return;

        // 3. Deposit ETH into Arbitrum Inbox
        setState({ status: "depositing", feeHash });
        const depositData = encodeDepositEth();
        const depositHash = await eth.request<string>({
          method: "eth_sendTransaction",
          params: [
            {
              from: account,
              to: arbitrumBridge.inbox,
              value: "0x" + quote.netBridgeWei.toString(16),
              data: depositData,
            },
          ],
        });

        if (cancelledRef.current) return;

        // 4. Wait for deposit confirmation on L1
        setState({ status: "waiting", depositHash });
        for (let i = 0; i < 60; i++) {
          const receipt = await eth.request<any>({
            method: "eth_getTransactionReceipt",
            params: [depositHash],
          });
          if (receipt) {
            if (receipt.status === "0x1") {
              setState({ status: "success", depositHash, feeHash });
            } else {
              setState({
                status: "error",
                message: "Deposit transaction reverted.",
              });
            }
            return;
          }
          await new Promise((r) => setTimeout(r, 3000));
        }

        // Timeout waiting for receipt — still pending
        setState({ status: "success", depositHash, feeHash });
      } catch (err: any) {
        if (!cancelledRef.current) {
          setState({
            status: "error",
            message: err?.message || "Bridge failed.",
          });
        }
      }
    },
    []
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setState({ status: "idle" });
  }, []);

  return { state, execute, reset };
}

// ── L2 balance checker ──────────────────────────────────────────────────────

export function useL2Balance(account: string | null) {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!account) {
      setBalance(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(arbitrumBridge.l2Rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBalance",
          params: [account, "latest"],
        }),
      });
      const json = await res.json();
      if (json.result) {
        setBalance(BigInt(json.result));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return { balance, loading, formatted: balance != null ? formatWeiToEth(balance) : null, refresh };
}
