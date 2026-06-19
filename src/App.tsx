import { useMemo, useState } from "react";
import { assetConfig, sourceChain, targetChain } from "./config/chains";
import { feeConfig } from "./config/fees";
import { formatAmount, shortAddress } from "./lib/format";
import { estimateQuote } from "./lib/quote";
import { useBridgeExecution } from "./hooks/useBridgeExecution";
import { useRouteBinding } from "./hooks/useRouteBinding";
import { useRouteHealth } from "./hooks/useRouteHealth";
import { useWallet } from "./hooks/useWallet";
import { SwapPanel } from "./components/SwapPanel";
import { swapConfig } from "./config/swap";

type Tab = "swap" | "bridge";

export default function App() {
  const [tab, setTab] = useState<Tab>("swap");
  const [amount, setAmount] = useState("1");
  const quote = useMemo(() => estimateQuote(Number(amount)), [amount]);
  const wallet = useWallet();
  const routeHealth = useRouteHealth();
  const execution = useBridgeExecution(quote);
  const routeBinding = useRouteBinding();

  const actionLabel = !wallet.account
    ? wallet.isConnecting
      ? "Connecting wallet..."
      : "Connect wallet"
    : !wallet.onSourceChain
      ? `Switch to ${sourceChain.name}`
    : routeBinding.liveExecutionReady
      ? "Prepare bridge execution"
      : "Prepare audited bridge plan";

  const actionDisabled =
    wallet.isConnecting || routeHealth.status === "checking" || routeHealth.status === "degraded";

  const handlePrimaryAction = async () => {
    if (!wallet.account) {
      await wallet.connect();
      return;
    }
    if (!wallet.onSourceChain) {
      await wallet.switchToSource();
      return;
    }
    execution.prepare();
  };

  return (
    <>
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark">R</span>
          ry<span>swap</span>
        </div>
        <span className="header-tag">
          <span className="dot" /> Live · Ethereum Mainnet
        </span>
      </header>

      <main className="page">
      <section className="hero">
        <p className="eyebrow">Non-custodial · Fee-first DeFi</p>
        <h1>
          Swap ETH with a <span className="accent">transparent 0.3% fee.</span>
        </h1>
        <p className="lede">
          You keep your funds until you sign. Live quotes, slippage protection,
          and output sent straight to your wallet — no custody, no operator
          float. Bridge to rbETH on Robinhood Chain <strong>{targetChain.id}</strong>{" "}
          is staged next.
        </p>
      </section>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === "swap" ? "tab-active" : ""}`}
          onClick={() => setTab("swap")}
        >
          Swap (Live)
        </button>
        <button
          type="button"
          className={`tab ${tab === "bridge" ? "tab-active" : ""}`}
          onClick={() => setTab("bridge")}
        >
          Bridge {targetChain.id} (Preview)
        </button>
      </div>

      {tab === "swap" ? (
        <section className="grid">
          <article className="card bridge-card">
            <SwapPanel
              account={wallet.account}
              chainId={wallet.chainId}
              onConnect={() => void wallet.connect()}
              isConnecting={wallet.isConnecting}
            />
          </article>
          <article className="card">
            <h3>How the fee works</h3>
            <ul className="facts">
              <li>You send ETH to the FeeRouter contract.</li>
              <li>It skims a transparent {swapConfig.feeBps / 100}% fee.</li>
              <li>The rest is swapped on Uniswap SwapRouter02.</li>
              <li>Output token lands directly in your wallet.</li>
              <li>Non-custodial: no operator float, no custody.</li>
              <li>Fee cap is hard-coded at 1% in the contract.</li>
            </ul>
          </article>
        </section>
      ) : (
        <section className="grid">
          <article className="card bridge-card">
            <div className="card-head">
              <div>
                <p className="label">Preview · not live</p>
                <h2>
                  {sourceChain.name} to {targetChain.name}
                </h2>
              </div>
              <span className="pill">Fee-first non-custodial</span>
            </div>

            <label className="input-wrap">
              <span>Amount in ETH</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>

            <div className="quote">
              <div>
                <span>Gross deposit</span>
                <strong>{formatAmount(quote.grossEthIn)} ETH</strong>
              </div>
              <div>
                <span>Platform fee</span>
                <strong>{formatAmount(quote.feeEth)} ETH</strong>
              </div>
              <div>
                <span>Net bridge amount</span>
                <strong>{formatAmount(quote.netEthBridged)} ETH</strong>
              </div>
              <div>
                <span>Route health</span>
                <strong className={`route-${routeHealth.status}`}>
                  {routeHealth.status}
                </strong>
              </div>
              <div>
                <span>Estimated rbETH out</span>
                <strong>{formatAmount(quote.estimatedRbEthOut)} rbETH</strong>
              </div>
            </div>

            <div className={`health-box health-${routeHealth.status}`}>
              <strong>{routeHealth.message}</strong>
              <span>
                Latest block:{" "}
                {routeHealth.blockNumber != null ? routeHealth.blockNumber : "unknown"}
              </span>
            </div>

            {wallet.error ? <p className="error-text">{wallet.error}</p> : null}
            {execution.error ? <p className="error-text">{execution.error}</p> : null}

            <button
              className="primary-button"
              type="button"
              disabled={actionDisabled}
              onClick={() => {
                void handlePrimaryAction();
              }}
            >
              {actionLabel}
            </button>

            {execution.prepared ? (
              <div className="execution-panel">
                <div className="execution-grid">
                  <div>
                    <span>Prepared gross</span>
                    <strong>{execution.prepared.grossEthFormatted} ETH</strong>
                  </div>
                  <div>
                    <span>Prepared fee</span>
                    <strong>{execution.prepared.feeEthFormatted} ETH</strong>
                  </div>
                  <div>
                    <span>Prepared net bridge</span>
                    <strong>{execution.prepared.netEthFormatted} ETH</strong>
                  </div>
                  <div>
                    <span>Fee recipient</span>
                    <strong>{shortAddress(execution.prepared.feeRecipient)}</strong>
                  </div>
                </div>

                <p className="execution-note">{execution.prepared.routeBindingNote}</p>

                <ul className="step-list">
                  {execution.prepared.steps.map((step) => (
                    <li key={step.key} className="step-item">
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.description}</p>
                      </div>
                      <span className={`pill step-${step.status}`}>{step.status}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => execution.clear()}
                >
                  Clear prepared execution
                </button>
              </div>
            ) : null}
          </article>

          <article className="card">
            <h3>Bridge launch assumptions</h3>
            <ul className="facts">
              <li>
                Wallet:{" "}
                {wallet.account ? shortAddress(wallet.account) : "not connected yet"}
              </li>
              <li>Expected source chain: {sourceChain.name}</li>
              <li>Destination asset: rbETH</li>
              <li>Destination chain: Robinhood Chain {targetChain.id}</li>
              <li>Platform fee: {feeConfig.bps / 100}%</li>
              <li>rbETH token: {shortAddress(assetConfig.rbEthAddress)}</li>
              <li>
                Live route status:{" "}
                {routeBinding.liveExecutionReady ? "ready" : "audit mode only"}
              </li>
            </ul>
          </article>

          <article className="card wide">
            <h3>Route binding audit</h3>
            <p className="route-blocker">{routeBinding.blocker}</p>
            <div className="audit-list">
              {routeBinding.candidates.map((candidate) => (
                <div key={candidate.id} className="audit-item">
                  <div className="audit-head">
                    <strong>{candidate.label}</strong>
                    <span className={`pill audit-${candidate.status}`}>
                      {candidate.status}
                    </span>
                  </div>
                  <p>{candidate.summary}</p>
                  <ul>
                    {candidate.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}
      </main>

      <footer className="site-footer">
        <span>ryswap · non-custodial fee swap</span>
        <span>
          Contract:{" "}
          <a
            href={`https://etherscan.io/address/${swapConfig.feeRouter}`}
            target="_blank"
            rel="noreferrer"
          >
            {shortAddress(swapConfig.feeRouter)}
          </a>
        </span>
      </footer>
    </>
  );
}
