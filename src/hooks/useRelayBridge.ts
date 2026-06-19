import { useCallback, useEffect, useRef, useState } from "react";
import {
  RELAY_API,
  BRIDGE_FEE_BPS,
  BRIDGE_FEE_RECIPIENT,
  NATIVE,
  type BridgeChain,
} from "../config/bridge";

export type BridgeQuote = {
  outFormatted: string;
  outSymbol: string;
  minFormatted: string;
  appFeeFormatted: string;
  timeEstimate: number | null;
  steps: any[];
  raw: any;
};

type QuoteState = {
  loading: boolean;
  quote: BridgeQuote | null;
  error: string | null;
};

function toWei(amountEth: string): bigint {
  const v = Number(amountEth);
  if (!Number.isFinite(v) || v <= 0) return 0n;
  return BigInt(Math.round(v * 1e18));
}

function fmt(raw: string, decimals: number): string {
  return (Number(raw) / 10 ** decimals).toFixed(6);
}

// Fetch a live Relay quote (native ETH -> native ETH across chains) with our app fee.
export function useBridgeQuote(
  account: string | null,
  amountEth: string,
  from: BridgeChain,
  to: BridgeChain
): QuoteState {
  const [state, setState] = useState<QuoteState>({
    loading: false,
    quote: null,
    error: null,
  });
  const reqId = useRef(0);

  useEffect(() => {
    const wei = toWei(amountEth);
    if (wei <= 0n || from.id === to.id) {
      setState({ loading: false, quote: null, error: null });
      return;
    }
    if (to.pending) {
      setState({
        loading: false,
        quote: null,
        error: `${to.name} is not yet live on Relay. This route auto-enables once Relay lists chain ${to.id}.`,
      });
      return;
    }

    const id = ++reqId.current;
    setState({ loading: true, quote: null, error: null });

    const user = account || "0x000000000000000000000000000000000000dEaD";
    const body = {
      user,
      recipient: user,
      originChainId: from.id,
      destinationChainId: to.id,
      originCurrency: NATIVE,
      destinationCurrency: NATIVE,
      amount: wei.toString(),
      tradeType: "EXACT_INPUT",
      appFees: [{ recipient: BRIDGE_FEE_RECIPIENT, fee: String(BRIDGE_FEE_BPS) }],
    };

    fetch(`${RELAY_API}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        const j = await r.json();
        if (id !== reqId.current) return;
        if (!r.ok) {
          setState({
            loading: false,
            quote: null,
            error: j?.message || `Quote failed (${r.status})`,
          });
          return;
        }
        const out = j.details?.currencyOut;
        const app = j.fees?.app;
        const quote: BridgeQuote = {
          outFormatted: out?.amountFormatted
            ? Number(out.amountFormatted).toFixed(6)
            : fmt(out?.amount || "0", out?.currency?.decimals || 18),
          outSymbol: out?.currency?.symbol || to.short,
          minFormatted: out?.minimumAmount
            ? fmt(out.minimumAmount, out?.currency?.decimals || 18)
            : "—",
          appFeeFormatted: app?.amountFormatted
            ? Number(app.amountFormatted).toFixed(6)
            : "0",
          timeEstimate: j.details?.timeEstimate ?? null,
          steps: j.steps || [],
          raw: j,
        };
        setState({ loading: false, quote, error: null });
      })
      .catch((e) => {
        if (id !== reqId.current) return;
        setState({ loading: false, quote: null, error: e?.message || "Quote failed" });
      });
  }, [account, amountEth, from, to]);

  return state;
}

type ExecState =
  | { status: "idle" }
  | { status: "pending"; hash?: string }
  | { status: "success"; hash: string }
  | { status: "error"; message: string };

// Execute the bridge: send the transaction(s) returned by Relay's quote.
export function useBridgeExecute(from: BridgeChain) {
  const [state, setState] = useState<ExecState>({ status: "idle" });

  const execute = useCallback(
    async (account: string, quote: BridgeQuote) => {
      const eth = (window as unknown as { ethereum?: any }).ethereum;
      if (!eth) {
        setState({ status: "error", message: "No injected wallet found." });
        return;
      }
      try {
        setState({ status: "pending" });

        // Ensure wallet is on the origin chain.
        const current: string = await eth.request({ method: "eth_chainId" });
        if (parseInt(current, 16) !== from.id) {
          try {
            await eth.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: from.hex }],
            });
          } catch (switchErr: any) {
            setState({
              status: "error",
              message: `Switch wallet to ${from.name} (chainId ${from.id}) and retry.`,
            });
            return;
          }
        }

        // Relay returns steps[].items[].data = ready-to-send tx objects.
        let lastHash = "";
        for (const step of quote.steps) {
          for (const item of step.items || []) {
            const tx = item.data;
            if (!tx?.to) continue;
            const params: any = {
              from: account,
              to: tx.to,
              data: tx.data,
              value: tx.value ? "0x" + BigInt(tx.value).toString(16) : "0x0",
            };
            const hash: string = await eth.request({
              method: "eth_sendTransaction",
              params: [params],
            });
            lastHash = hash;
          }
        }

        if (lastHash) {
          setState({ status: "success", hash: lastHash });
        } else {
          setState({ status: "error", message: "No executable step returned by Relay." });
        }
      } catch (e: any) {
        setState({ status: "error", message: e?.message || "Bridge failed." });
      }
    },
    [from]
  );

  return { state, execute, reset: () => setState({ status: "idle" }) };
}
