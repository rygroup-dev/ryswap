import { useEffect, useMemo, useState } from "react";
import { launchpad, type LaunchToken } from "../../launchpad";
import { marketCap, priceOf, graduationProgress, buy as curveBuy, sell as curveSell } from "../../launchpad/bondingCurve";
import { Sparkline } from "./Sparkline";
import { HolderTracker } from "./HolderTracker";
import { ActivityFeed } from "./ActivityFeed";

export function TokenPage({
  id,
  account,
  onBack,
}: {
  id: string;
  account: string | null;
  onBack: () => void;
}) {
  const [token, setToken] = useState<LaunchToken | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.05");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void launchpad.getToken(id).then((t) => {
        if (active) setToken(t);
      });
    };
    refresh();
    const unsub = launchpad.subscribe(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, [id]);

  const myBalance = useMemo(() => {
    if (!token || !account) return 0;
    return token.holders.find((h) => h.account.toLowerCase() === account.toLowerCase())?.balance ?? 0;
  }, [token, account]);

  const estimate = useMemo(() => {
    if (!token) return null;
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return null;
    if (side === "buy") return { out: curveBuy(token.curve, v).tokensOut, unit: token.ticker };
    return { out: curveSell(token.curve, v).ethOut, unit: "ETH" };
  }, [token, amount, side]);

  if (!token) {
    return (
      <section className="grid">
        <article className="card bridge-card">
          <button type="button" className="secondary-button" onClick={onBack}>Back</button>
          <p className="execution-note">Loading coin…</p>
        </article>
      </section>
    );
  }

  const pct = Math.round(graduationProgress(token.curve) * 100);

  const trade = async () => {
    setError(null);
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return setError("Enter a valid amount.");
    if (side === "sell" && v > myBalance) return setError("Not enough balance.");
    setBusy(true);
    try {
      if (side === "buy") await launchpad.buy(id, v, account || "0xanon");
      else await launchpad.sell(id, v, account || "0xanon");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trade failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid">
      <article className="card bridge-card">
        <div className="card-head">
          <div>
            <p className="label">${token.ticker} · {token.graduated ? "Graduated" : "Bonding curve"}</p>
            <h2>{token.name}</h2>
          </div>
          <button type="button" className="secondary-button" onClick={onBack}>Back</button>
        </div>

        <Sparkline points={token.trades.map((t) => t.priceAfter)} />

        <div className="mini-grid">
          <div className="mini-stat"><span>Price</span><strong>{priceOf(token.curve).toExponential(3)} ETH</strong></div>
          <div className="mini-stat"><span>Market cap</span><strong>~{marketCap(token.curve).toFixed(2)} ETH</strong></div>
          <div className="mini-stat"><span>Raised</span><strong>{token.curve.ethReserve.toFixed(4)} ETH</strong></div>
        </div>

        <div className="launch-progress big">
          <div className="launch-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="execution-note">{token.graduated ? "Graduated to the DEX ✨" : `${pct}% to graduation`}</p>

        {!token.graduated ? (
          <>
            <div className="bridge-mode-tabs">
              <button type="button" className={`mode-tab ${side === "buy" ? "mode-active" : ""}`} onClick={() => setSide("buy")}>Buy</button>
              <button type="button" className={`mode-tab ${side === "sell" ? "mode-active" : ""}`} onClick={() => setSide("sell")}>Sell</button>
            </div>
            <label className="input-wrap">
              <span>{side === "buy" ? "Amount in ETH" : `Amount in ${token.ticker}`}</span>
              <input type="number" min="0" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            {estimate ? (
              <p className="execution-note">≈ {estimate.out.toLocaleString(undefined, { maximumFractionDigits: 6 })} {estimate.unit}</p>
            ) : null}
            {error ? <p className="error-text">{error}</p> : null}
            <button type="button" className="primary-button" disabled={busy} onClick={() => void trade()}>
              {busy ? "Processing…" : side === "buy" ? `Buy ${token.ticker}` : `Sell ${token.ticker}`}
            </button>
            {account ? (
              <p className="execution-note">Your balance: {myBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {token.ticker}</p>
            ) : (
              <p className="execution-note">Connect a wallet to tag your trades (mock — no tx sent).</p>
            )}
          </>
        ) : (
          <p className="execution-note">This coin graduated — trade it on the DEX swap tab.</p>
        )}
      </article>

      <article className="card">
        <h3>Holders</h3>
        <HolderTracker holders={token.holders} />
        <h3 style={{ marginTop: 18 }}>Live activity</h3>
        <ActivityFeed trades={token.trades} />
      </article>
    </section>
  );
}
