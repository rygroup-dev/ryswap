import { useMemo, useState } from "react";
import { swapConfig, swapTokens } from "../config/swap";
import { shortAddress } from "../lib/format";
import { useSwapExecution } from "../hooks/useSwapExecution";
import { useQuote } from "../hooks/useQuote";

function fmtEth(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(6);
}
function fmtToken(raw: bigint, decimals: number): string {
  return (Number(raw) / 10 ** decimals).toFixed(decimals === 6 ? 4 : 6);
}

const SLIPPAGE_OPTIONS = [
  { label: "0.5%", bps: 50 },
  { label: "1%", bps: 100 },
  { label: "2%", bps: 200 },
];

export function SwapPanel({
  account,
  chainId,
  walletBalance,
  walletSymbol,
  walletChainName,
  balanceLoading,
  onConnect,
  isConnecting,
}: {
  account: string | null;
  chainId: number | null;
  walletBalance: string | null;
  walletSymbol: string | null;
  walletChainName: string | null;
  balanceLoading: boolean;
  onConnect: () => void;
  isConnecting: boolean;
}) {
  const [amount, setAmount] = useState("0.01");
  const [tokenSymbol, setTokenSymbol] = useState(swapTokens[0].symbol);
  const [slippageBps, setSlippageBps] = useState(100);
  const token = useMemo(
    () => swapTokens.find((t) => t.symbol === tokenSymbol) ?? swapTokens[0],
    [tokenSymbol]
  );

  // Compute fee split locally for the quote (mirror of hook math).
  const total = useMemo(() => {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return 0n;
    return BigInt(Math.round(v * 1e18));
  }, [amount]);
  const forward = useMemo(
    () => total - (total * BigInt(swapConfig.feeBps)) / 10000n,
    [total]
  );

  const quote = useQuote(forward, token);

  // amountOutMinimum = quote * (1 - slippage)
  const amountOutMinimum = useMemo(() => {
    if (quote.amountOut == null) return 0n;
    return (quote.amountOut * BigInt(10000 - slippageBps)) / 10000n;
  }, [quote.amountOut, slippageBps]);

  const swap = useSwapExecution(account, amount, token, amountOutMinimum);
  const onMainnet = chainId === swapConfig.chainId;

  const useMax = () => {
    if (!walletBalance || !onMainnet) return;
    const numeric = Number(walletBalance);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const next = Math.max(numeric - 0.003, 0);
    setAmount(next > 0 ? next.toFixed(4) : "0");
  };

  const disabled =
    !account ||
    !onMainnet ||
    swap.split.total <= 0n ||
    quote.amountOut == null ||
    swap.state.status === "pending";

  return (
    <div className="swap-panel">
      <div className="card-head">
        <div>
          <p className="label">Live · Ethereum Mainnet</p>
          <h2>Swap ETH → token (0.3% fee)</h2>
        </div>
        <span className="pill live-pill">LIVE</span>
      </div>

      <div className="wallet-strip">
        <div>
          <span className="wallet-strip-label">Wallet</span>
          <strong>{account ? shortAddress(account) : "Not connected"}</strong>
        </div>
        <div>
          <span className="wallet-strip-label">Active chain</span>
          <strong>{walletChainName || "Connect wallet"}</strong>
        </div>
        <div>
          <span className="wallet-strip-label">Native balance</span>
          <strong>
            {!account
              ? "—"
              : balanceLoading
                ? "Reading..."
                : walletBalance && walletSymbol
                  ? `${walletBalance} ${walletSymbol}`
                  : "—"}
          </strong>
        </div>
      </div>

      <label className="input-wrap">
        <span>Amount in ETH</span>
        <div className="amount-input-row">
          <input
            type="number"
            min="0"
            step="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            className="amount-chip"
            type="button"
            disabled={!onMainnet || !walletBalance}
            onClick={useMax}
          >
            Max
          </button>
        </div>
      </label>

      <label className="input-wrap">
        <span>Receive token</span>
        <select value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)}>
          {swapTokens.map((t) => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol}
            </option>
          ))}
        </select>
      </label>

      <label className="input-wrap">
        <span>Max slippage</span>
        <select
          value={slippageBps}
          onChange={(e) => setSlippageBps(Number(e.target.value))}
        >
          {SLIPPAGE_OPTIONS.map((o) => (
            <option key={o.bps} value={o.bps}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="quote">
        <div>
          <span>You pay</span>
          <strong>{fmtEth(swap.split.total)} ETH</strong>
        </div>
        <div>
          <span>Platform fee ({swapConfig.feeBps / 100}%)</span>
          <strong>{fmtEth(swap.split.fee)} ETH</strong>
        </div>
        <div>
          <span>Estimated output</span>
          <strong>
            {quote.loading
              ? "quoting..."
              : quote.amountOut != null
                ? `${fmtToken(quote.amountOut, token.decimals)} ${token.symbol}`
                : "—"}
          </strong>
        </div>
        <div>
          <span>Minimum received ({slippageBps / 100}% slip)</span>
          <strong>
            {amountOutMinimum > 0n
              ? `${fmtToken(amountOutMinimum, token.decimals)} ${token.symbol}`
              : "—"}
          </strong>
        </div>
      </div>

      <div className="mini-grid">
        <div className="mini-stat">
          <span>Route</span>
          <strong>ETH to {token.symbol}</strong>
        </div>
        <div className="mini-stat">
          <span>Wallet status</span>
          <strong>{onMainnet ? "Mainnet ready" : "Switch required"}</strong>
        </div>
        <div className="mini-stat">
          <span>Output token</span>
          <strong>{token.symbol}</strong>
        </div>
      </div>

      {quote.error ? <p className="error-text">Quote error: {quote.error}</p> : null}

      {!account ? (
        <button
          className="primary-button"
          type="button"
          disabled={isConnecting}
          onClick={onConnect}
        >
          {isConnecting ? "Connecting..." : "Connect wallet"}
        </button>
      ) : !onMainnet ? (
        <p className="error-text">
          Switch wallet to Ethereum Mainnet (chainId 1) to swap.
        </p>
      ) : (
        <button
          className="primary-button"
          type="button"
          disabled={disabled}
          onClick={() => void swap.execute()}
        >
          {swap.state.status === "pending"
            ? "Swapping..."
            : quote.amountOut == null
              ? "Waiting for quote..."
              : `Swap to ${token.symbol}`}
        </button>
      )}

      {swap.state.status === "success" ? (
        <div className="health-box health-healthy">
          <strong>Swap confirmed ✅</strong>
          <a href={swap.explorerUrl(swap.state.hash)} target="_blank" rel="noreferrer">
            View on Etherscan
          </a>
        </div>
      ) : null}
      {swap.state.status === "error" ? (
        <p className="error-text">{swap.state.message}</p>
      ) : null}
      {swap.state.status === "pending" && swap.state.hash ? (
        <p className="execution-note">
          Pending:{" "}
          <a href={swap.explorerUrl(swap.state.hash)} target="_blank" rel="noreferrer">
            {shortAddress(swap.state.hash)}
          </a>
        </p>
      ) : null}

      <ul className="facts compact">
        <li>FeeRouter: {shortAddress(swapConfig.feeRouter)}</li>
        <li>Fee recipient: {shortAddress(swapConfig.feeRecipient)}</li>
        <li>Router: Uniswap SwapRouter02 · Quoter: QuoterV2</li>
      </ul>
    </div>
  );
}
