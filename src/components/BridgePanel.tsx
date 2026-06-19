import { useEffect, useMemo, useRef, useState } from "react";
import {
  bridgeChains,
  BRIDGE_FEE_BPS,
  BRIDGE_FEE_RECIPIENT,
  chainById,
  type BridgeChain,
} from "../config/bridge";
import { feeConfig } from "../config/fees";
import { shortAddress } from "../lib/format";
import { useBridgeExecute, useBridgeQuote } from "../hooks/useRelayBridge";
import {
  useNativeBridgeQuote,
  useArbitrumBridgeExecution,
  useL2Balance,
} from "../hooks/useArbitrumBridge";
import { arbitrumBridge } from "../config/arbitrumBridge";

type BridgeMode = "direct" | "relay";

type BridgeActivity = {
  id: string;
  amount: string;
  fromName: string;
  toName: string;
  status: "submitted" | "failed";
  createdAt: string;
  feeLabel: string;
  receiveLabel: string;
  hash?: string;
  error?: string;
};

type ActivityDraft = {
  amount: string;
  fromName: string;
  toName: string;
  feeLabel: string;
  receiveLabel: string;
};

const ACTIVITY_STORAGE_KEY = "ryswap-bridge-activity";
const POPULAR_CHAIN_IDS = new Set([1, 10, 56, 324, 8453, 42161, 59144, 81457, 167000, 534352]);

function getChainBucket(chain: BridgeChain) {
  if (chain.pending) return "Soon";
  if (POPULAR_CHAIN_IDS.has(chain.id)) return "Popular";
  if (chain.short !== "ETH") return "Alt gas chains";
  return "More EVM routes";
}

function getChainGroups(
  query: string,
  includePending: boolean,
  selectedId: number
): { label: string; chains: BridgeChain[] }[] {
  const normalized = query.trim().toLowerCase();
  const pool = bridgeChains.filter((chain) => includePending || !chain.pending);
  const selected = chainById(selectedId);

  const filtered = normalized
    ? pool.filter((chain) => {
        const haystack = `${chain.name} ${chain.short} ${chain.id}`.toLowerCase();
        return haystack.includes(normalized);
      })
    : pool;

  const visible =
    selected && !filtered.some((chain) => chain.id === selected.id) ? [selected, ...filtered] : filtered;

  const buckets = new Map<string, BridgeChain[]>();
  for (const chain of visible) {
    const label = getChainBucket(chain);
    const list = buckets.get(label) ?? [];
    list.push(chain);
    buckets.set(label, list);
  }

  return ["Popular", "Alt gas chains", "More EVM routes", "Soon"]
    .map((label) => ({ label, chains: buckets.get(label) ?? [] }))
    .filter((group) => group.chains.length > 0);
}

function loadActivity(): BridgeActivity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveActivity(entry: BridgeActivity) {
  if (typeof window === "undefined") return [];
  const next = [entry, ...loadActivity()].slice(0, 6);
  window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nativeBridgeStatusLabel(status: string): string {
  switch (status) {
    case "switching":
      return "Switching to Ethereum...";
    case "sending-fee":
      return "Sending fee...";
    case "depositing":
      return "Depositing to Inbox...";
    case "waiting":
      return "Waiting for confirmation...";
    default:
      return "Processing...";
  }
}

function ModeSelector({
  mode,
  setMode,
  liveChainCount,
}: {
  mode: BridgeMode;
  setMode: (m: BridgeMode) => void;
  liveChainCount: number;
}) {
  return (
    <div className="bridge-mode-tabs">
      <button
        type="button"
        className={`mode-tab ${mode === "direct" ? "mode-active" : ""}`}
        onClick={() => setMode("direct")}
      >
        Direct Bridge
      </button>
      <button
        type="button"
        className={`mode-tab ${mode === "relay" ? "mode-active" : ""}`}
        onClick={() => setMode("relay")}
      >
        Multichain ({liveChainCount})
      </button>
    </div>
  );
}

export function BridgePanel({
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
  const [mode, setMode] = useState<BridgeMode>("direct");
  const [amount, setAmount] = useState("0.01");

  // Relay state
  const [fromId, setFromId] = useState(1);
  const [toId, setToId] = useState(8453);
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [activity, setActivity] = useState<BridgeActivity[]>([]);

  const from = useMemo(() => chainById(fromId) ?? bridgeChains[0], [fromId]);
  const to = useMemo(() => chainById(toId) ?? bridgeChains[1], [toId]);
  const fromGroups = useMemo(() => getChainGroups(fromQuery, false, from.id), [fromQuery, from.id]);
  const toGroups = useMemo(() => getChainGroups(toQuery, true, to.id), [toQuery, to.id]);
  const fromCount = fromGroups.reduce((sum, group) => sum + group.chains.length, 0);
  const toCount = toGroups.reduce((sum, group) => sum + group.chains.length, 0);

  const { loading, quote, error } = useBridgeQuote(account, amount, from, to);
  const exec = useBridgeExecute(from);
  const liveChainCount = bridgeChains.filter((chain) => !chain.pending).length;
  const walletMatchesOrigin = chainId === from.id;
  const attemptRef = useRef<ActivityDraft | null>(null);
  const lastSavedRef = useRef("");

  // Native bridge state
  const nativeQuote = useNativeBridgeQuote(amount);
  const nativeExec = useArbitrumBridgeExecution();
  const l2Balance = useL2Balance(account);
  const onEthMainnet = chainId === 1;

  useEffect(() => {
    setActivity(loadActivity());
  }, []);

  useEffect(() => {
    const attempt = attemptRef.current;
    if (!attempt) return;

    if (exec.state.status === "success" && exec.state.hash !== lastSavedRef.current) {
      const entry: BridgeActivity = {
        id: `${Date.now()}-${exec.state.hash}`,
        amount: attempt.amount,
        fromName: attempt.fromName,
        toName: attempt.toName,
        status: "submitted",
        createdAt: new Date().toISOString(),
        feeLabel: attempt.feeLabel,
        receiveLabel: attempt.receiveLabel,
        hash: exec.state.hash,
      };
      setActivity(saveActivity(entry));
      lastSavedRef.current = exec.state.hash;
    }

    if (exec.state.status === "error" && exec.state.message !== lastSavedRef.current) {
      const entry: BridgeActivity = {
        id: `${Date.now()}-failed`,
        amount: attempt.amount,
        fromName: attempt.fromName,
        toName: attempt.toName,
        status: "failed",
        createdAt: new Date().toISOString(),
        feeLabel: attempt.feeLabel,
        receiveLabel: attempt.receiveLabel,
        error: exec.state.message,
      };
      setActivity(saveActivity(entry));
      lastSavedRef.current = exec.state.message;
    }
  }, [exec.state]);

  // Track native bridge activity
  useEffect(() => {
    if (nativeExec.state.status === "success") {
      const entry: BridgeActivity = {
        id: `${Date.now()}-native-${nativeExec.state.depositHash}`,
        amount: `${amount} ETH`,
        fromName: "Ethereum",
        toName: "Robinhood Chain",
        status: "submitted",
        createdAt: new Date().toISOString(),
        feeLabel: nativeQuote.quote ? `${nativeQuote.quote.feeFormatted} ETH` : "—",
        receiveLabel: nativeQuote.quote ? `${nativeQuote.quote.netFormatted} ETH` : "—",
        hash: nativeExec.state.depositHash,
      };
      setActivity(saveActivity(entry));
    }
  }, [nativeExec.state.status]);

  const swapDirection = () => {
    setFromId(toId);
    setToId(fromId);
    setFromQuery("");
    setToQuery("");
  };

  const useMax = () => {
    if (!walletBalance) return;
    if (mode === "direct") {
      if (!onEthMainnet) return;
    } else {
      if (!walletMatchesOrigin) return;
    }
    const numeric = Number(walletBalance);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const reserve = 0.003;
    const next = Math.max(numeric - reserve, 0);
    setAmount(next > 0 ? next.toFixed(4) : "0");
  };

  const handleBridge = () => {
    if (!quote || !account) return;
    attemptRef.current = {
      amount: `${amount} ${from.short}`,
      fromName: from.name,
      toName: to.name,
      feeLabel: `${quote.appFeeFormatted} ${quote.appFeeSymbol}`,
      receiveLabel: `${quote.outFormatted} ${quote.outSymbol}`,
    };
    lastSavedRef.current = "";
    void exec.execute(account, quote);
  };

  const clearActivity = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVITY_STORAGE_KEY);
    }
    setActivity([]);
  };

  // ── Direct bridge (Arbitrum native) ───────────────────────────────────

  if (mode === "direct") {
    const q = nativeQuote.quote;
    const busy =
      nativeExec.state.status === "switching" ||
      nativeExec.state.status === "sending-fee" ||
      nativeExec.state.status === "depositing" ||
      nativeExec.state.status === "waiting";
    const disabled = !account || !q || busy || !onEthMainnet;

    return (
      <div className="swap-panel">
        <div className="card-head">
          <div>
            <p className="label">Live · Ethereum → Robinhood Chain</p>
            <h2>Bridge ETH to Robinhood Chain</h2>
          </div>
          <span className="pill live-pill">LIVE</span>
        </div>

        <ModeSelector mode={mode} setMode={setMode} liveChainCount={liveChainCount} />

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
            <span className="wallet-strip-label">L1 balance</span>
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

        <div className="mini-grid">
          <div className="mini-stat">
            <span>Robinhood balance</span>
            <strong>
              {l2Balance.loading
                ? "Reading..."
                : l2Balance.formatted != null
                  ? `${l2Balance.formatted} ETH`
                  : "—"}
            </strong>
          </div>
          <div className="mini-stat">
            <span>Route</span>
            <strong>Arbitrum Inbox</strong>
          </div>
          <div className="mini-stat">
            <span>Wallet status</span>
            <strong>{onEthMainnet ? "Mainnet ready" : "Switch to Ethereum"}</strong>
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
              disabled={!onEthMainnet || !walletBalance}
              onClick={useMax}
            >
              Max
            </button>
          </div>
        </label>

        <div className="quote">
          <div>
            <span>You send</span>
            <strong>{q ? `${q.grossFormatted} ETH` : "—"}</strong>
          </div>
          <div>
            <span>Platform fee ({feeConfig.bps / 100}%)</span>
            <strong>{q ? `${q.feeFormatted} ETH` : "—"}</strong>
          </div>
          <div>
            <span>You receive on Robinhood</span>
            <strong>{q ? `${q.netFormatted} ETH` : "—"}</strong>
          </div>
          <div>
            <span>Est. arrival</span>
            <strong>{q ? `~${Math.round(q.etaSeconds / 60)} min` : "—"}</strong>
          </div>
        </div>

        {nativeQuote.error ? <p className="error-text">{nativeQuote.error}</p> : null}

        {!account ? (
          <button className="primary-button" type="button" disabled={isConnecting} onClick={onConnect}>
            {isConnecting ? "Connecting..." : "Connect wallet"}
          </button>
        ) : !onEthMainnet ? (
          <p className="error-text">Switch wallet to Ethereum Mainnet (chainId 1) to bridge.</p>
        ) : (
          <button
            className="primary-button"
            type="button"
            disabled={disabled}
            onClick={() => q && account && void nativeExec.execute(account, q)}
          >
            {busy ? nativeBridgeStatusLabel(nativeExec.state.status) : "Bridge to Robinhood Chain"}
          </button>
        )}

        {nativeExec.state.status === "success" ? (
          <div className="health-box health-healthy">
            <strong>Bridge deposit confirmed</strong>
            <span>ETH will arrive on Robinhood Chain within ~10-15 minutes.</span>
            <a
              href={`${arbitrumBridge.l1Explorer}/tx/${nativeExec.state.depositHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View L1 deposit on Etherscan
            </a>
          </div>
        ) : null}
        {nativeExec.state.status === "error" ? (
          <p className="error-text">{nativeExec.state.message}</p>
        ) : null}

        <ActivityPanel activity={activity} clearActivity={clearActivity} />

        <ul className="facts compact">
          <li>Route: Arbitrum native bridge (Inbox {shortAddress(arbitrumBridge.inbox)})</li>
          <li>Fee recipient: {shortAddress(feeConfig.recipient)}</li>
          <li>Trustless: deposit goes through canonical Arbitrum Inbox on L1</li>
          <li>Non-custodial: ETH lands as native ETH on Robinhood Chain</li>
          <li>No operator float, no third-party relayer dependency</li>
        </ul>
      </div>
    );
  }

  // ── Relay multichain bridge ───────────────────────────────────────────

  const statusTone =
    exec.state.status === "success"
      ? "health-healthy"
      : exec.state.status === "error" || Boolean(error)
        ? "health-degraded"
        : exec.state.status === "pending" || loading
          ? "health-checking"
          : "health-box";

  const statusTitle = to.pending
    ? `${to.name} waiting on Relay listing`
    : exec.state.status === "success"
      ? "Bridge submitted to Relay"
      : exec.state.status === "error"
        ? "Bridge submission failed"
        : exec.state.status === "pending"
          ? "Waiting for wallet confirmation"
          : loading
            ? "Fetching best route quote"
            : error
              ? "Route needs attention"
              : quote
                ? "Route ready to send"
                : "Set amount to prepare route";

  const statusText = to.pending
    ? `Chain ${to.id} will auto-enable here as soon as Relay lists Robinhood Chain.`
    : exec.state.status === "success"
      ? `Latest route: ${from.name} to ${to.name}. You can track settlement on Relay.`
      : exec.state.status === "error"
        ? exec.state.message
        : exec.state.status === "pending"
          ? `Confirm the ${from.short} transaction in your wallet on ${from.name}.`
          : loading
            ? `Querying Relay for ${from.name} -> ${to.name}.`
            : error
              ? error
              : quote
                ? `Route is priced and ready. Estimated delivery: ${quote.timeEstimate != null ? `~${quote.timeEstimate}s` : "pending Relay estimate"}.`
                : "Choose a live route and amount to fetch a quote.";

  const relayDisabled =
    !account || !quote || loading || to.pending || exec.state.status === "pending";

  return (
    <div className="swap-panel">
      <div className="card-head">
        <div>
          <p className="label">Live · Powered by Relay</p>
          <h2>Bridge native assets across chains</h2>
        </div>
        <span className="pill live-pill">{liveChainCount} chains live</span>
      </div>

      <ModeSelector mode={mode} setMode={setMode} liveChainCount={liveChainCount} />

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

      <div className="chain-row">
        <div className="chain-picker">
          <div className="chain-picker-head">
            <span>From</span>
            <small>{fromCount} routes</small>
          </div>
          <input
            className="chain-search"
            type="text"
            value={fromQuery}
            onChange={(event) => setFromQuery(event.target.value)}
            placeholder="Search chain, gas token, or id"
          />
          <select value={fromId} onChange={(event) => setFromId(Number(event.target.value))}>
            {fromGroups.map((group) => (
              <optgroup key={group.label} label={`${group.label} (${group.chains.length})`}>
                {group.chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name} · {chain.short}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="chain-hint">Origin wallet should match this chain before submit.</p>
        </div>

        <button className="swap-dir" type="button" onClick={swapDirection} title="Swap direction">
          ⇄
        </button>

        <div className="chain-picker">
          <div className="chain-picker-head">
            <span>To</span>
            <small>{toCount} routes</small>
          </div>
          <input
            className="chain-search"
            type="text"
            value={toQuery}
            onChange={(event) => setToQuery(event.target.value)}
            placeholder="Search chain, gas token, or id"
          />
          <select value={toId} onChange={(event) => setToId(Number(event.target.value))}>
            {toGroups.map((group) => (
              <optgroup key={group.label} label={`${group.label} (${group.chains.length})`}>
                {group.chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                    {chain.pending ? " · soon" : ` · ${chain.short}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="chain-hint">
            Search helps on long lists, and Robinhood Chain stays pinned as soon.
          </p>
        </div>
      </div>

      <label className="input-wrap">
        <span>Amount in {from.short}</span>
        <div className="amount-input-row">
          <input
            type="number"
            min="0"
            step="0.001"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <button
            className="amount-chip"
            type="button"
            disabled={!walletMatchesOrigin || !walletBalance}
            onClick={useMax}
          >
            Max
          </button>
        </div>
      </label>

      <div className="mini-grid">
        <div className="mini-stat">
          <span>Origin asset</span>
          <strong>{from.short}</strong>
        </div>
        <div className="mini-stat">
          <span>Destination asset</span>
          <strong>{to.pending ? "Soon" : to.short}</strong>
        </div>
        <div className="mini-stat">
          <span>Wallet match</span>
          <strong>{walletMatchesOrigin ? "Ready" : `Switch to ${from.name}`}</strong>
        </div>
      </div>

      <div className={`health-box ${statusTone}`}>
        <strong>{statusTitle}</strong>
        <span>{statusText}</span>
        {exec.state.status === "success" ? (
          <a href={`https://relay.link/transaction/${exec.state.hash}`} target="_blank" rel="noreferrer">
            Track latest bridge on Relay
          </a>
        ) : null}
      </div>

      <div className="quote">
        <div>
          <span>Bridge fee ({BRIDGE_FEE_BPS / 100}%)</span>
          <strong>{quote ? `${quote.appFeeFormatted} ${quote.appFeeSymbol}` : "—"}</strong>
        </div>
        <div>
          <span>You receive on {to.name}</span>
          <strong>
            {loading ? "quoting..." : quote ? `${quote.outFormatted} ${quote.outSymbol}` : "—"}
          </strong>
        </div>
        <div>
          <span>Minimum received</span>
          <strong>{quote ? `${quote.minFormatted} ${quote.minSymbol}` : "—"}</strong>
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
        <button className="primary-button" type="button" disabled={relayDisabled} onClick={handleBridge}>
          {exec.state.status === "pending"
            ? "Bridging..."
            : to.pending
              ? `${to.name} not live yet`
              : !quote
                ? "Waiting for quote..."
                : `Bridge to ${to.name}`}
        </button>
      )}

      <ActivityPanel activity={activity} clearActivity={clearActivity} />

      <ul className="facts compact">
        <li>Fee recipient: {shortAddress(BRIDGE_FEE_RECIPIENT)}</li>
        <li>Routing: Relay.link aggregator · non-custodial</li>
        <li>Wallet auto-switches and can auto-add supported origin chains.</li>
        <li>Robinhood Chain 4663: auto-enables when Relay lists it.</li>
        <li>History is stored locally in the browser for quick route recall.</li>
      </ul>
    </div>
  );
}

function ActivityPanel({
  activity,
  clearActivity,
}: {
  activity: BridgeActivity[];
  clearActivity: () => void;
}) {
  return (
    <div className="activity-panel">
      <div className="activity-head">
        <div>
          <p className="label">Bridge status</p>
          <h3>Recent bridge activity</h3>
        </div>
        {activity.length > 0 ? (
          <button className="activity-clear" type="button" onClick={clearActivity}>
            Clear
          </button>
        ) : null}
      </div>

      {activity.length === 0 ? (
        <div className="activity-empty">
          <strong>No bridge history yet</strong>
          <span>Submitted routes from this browser will appear here with fee and receive summary.</span>
        </div>
      ) : (
        <div className="activity-list">
          {activity.map((item) => (
            <article className="activity-item" key={item.id}>
              <div className="activity-top">
                <div>
                  <strong>
                    {item.fromName} to {item.toName}
                  </strong>
                  <span>{item.amount}</span>
                </div>
                <span className={`pill ${item.status === "submitted" ? "activity-submitted" : "activity-failed"}`}>
                  {item.status === "submitted" ? "Submitted" : "Failed"}
                </span>
              </div>
              <div className="activity-meta">
                <span>{formatActivityTime(item.createdAt)}</span>
                <span>Fee {item.feeLabel}</span>
                <span>Receive {item.receiveLabel}</span>
              </div>
              {item.hash ? (
                <a
                  href={
                    item.fromName === "Ethereum" && item.toName === "Robinhood Chain"
                      ? `${arbitrumBridge.l1Explorer}/tx/${item.hash}`
                      : `https://relay.link/transaction/${item.hash}`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Track {shortAddress(item.hash)}
                </a>
              ) : null}
              {item.error ? <p>{item.error}</p> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
