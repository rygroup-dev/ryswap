import { useMemo, useState } from "react";
import {
  bridgeChains,
  BRIDGE_FEE_BPS,
  BRIDGE_FEE_RECIPIENT,
  chainById,
} from "../config/bridge";
import { shortAddress } from "../lib/format";
import { useBridgeQuote, useBridgeExecute } from "../hooks/useRelayBridge";

export function BridgePanel({
  account,
  onConnect,
  isConnecting,
}: {
  account: string | null;
  onConnect: () => void;
  isConnecting: boolean;
}) {
  const [amount, setAmount] = useState("0.01");
  const [fromId, setFromId] = useState(1);
  const [toId, setToId] = useState(8453);

  const from = useMemo(() => chainById(fromId) ?? bridgeChains[0], [fromId]);
  const to = useMemo(() => chainById(toId) ?? bridgeChains[1], [toId]);

  const { loading, quote, error } = useBridgeQuote(account, amount, from, to);
  const exec = useBridgeExecute(from);

  const swapDirection = () => {
    setFromId(toId);
    setToId(fromId);
  };

  const disabled =
    !account || !quote || loading || to.pending || exec.state.status === "pending";

  return (
    <div className="swap-panel">
      <div className="card-head">
        <div>
          <p className="label">Live · Powered by Relay</p>
          <h2>Bridge ETH across chains</h2>
        </div>
        <span className="pill live-pill">LIVE</span>
      </div>

      <div className="chain-row">
        <label className="input-wrap chain-col">
          <span>From</span>
          <select value={fromId} onChange={(e) => setFromId(Number(e.target.value))}>
            {bridgeChains
              .filter((c) => !c.pending)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>

        <button className="swap-dir" type="button" onClick={swapDirection} title="Swap direction">
          ⇄
        </button>

        <label className="input-wrap chain-col">
          <span>To</span>
          <select value={toId} onChange={(e) => setToId(Number(e.target.value))}>
            {bridgeChains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.pending ? " (soon)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="input-wrap">
        <span>Amount in ETH</span>
        <input
          type="number"
          min="0"
          step="0.001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      <div className="quote">
        <div>
          <span>Bridge fee ({BRIDGE_FEE_BPS / 100}%)</span>
          <strong>{quote ? `${quote.appFeeFormatted} ETH` : "—"}</strong>
        </div>
        <div>
          <span>You receive on {to.name}</span>
          <strong>
            {loading ? "quoting..." : quote ? `${quote.outFormatted} ${quote.outSymbol}` : "—"}
          </strong>
        </div>
        <div>
          <span>Minimum received</span>
          <strong>{quote ? `${quote.minFormatted} ETH` : "—"}</strong>
        </div>
        <div>
          <span>Est. time</span>
          <strong>{quote?.timeEstimate != null ? `~${quote.timeEstimate}s` : "—"}</strong>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {!account ? (
        <button className="primary-button" type="button" disabled={isConnecting} onClick={onConnect}>
          {isConnecting ? "Connecting..." : "Connect wallet"}
        </button>
      ) : (
        <button
          className="primary-button"
          type="button"
          disabled={disabled}
          onClick={() => quote && account && void exec.execute(account, quote)}
        >
          {exec.state.status === "pending"
            ? "Bridging..."
            : to.pending
              ? `${to.name} not live yet`
              : !quote
                ? "Waiting for quote..."
                : `Bridge to ${to.name}`}
        </button>
      )}

      {exec.state.status === "success" ? (
        <div className="health-box health-healthy">
          <strong>Bridge submitted ✅</strong>
          <a
            href={`https://relay.link/transaction/${exec.state.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            Track on Relay
          </a>
        </div>
      ) : null}
      {exec.state.status === "error" ? (
        <p className="error-text">{exec.state.message}</p>
      ) : null}

      <ul className="facts compact">
        <li>Fee recipient: {shortAddress(BRIDGE_FEE_RECIPIENT)}</li>
        <li>Routing: Relay.link aggregator · non-custodial</li>
        <li>Robinhood Chain 4663: auto-enables when Relay lists it</li>
      </ul>
    </div>
  );
}
