import { useState } from "react";
import { shortAddress } from "./lib/format";
import { useWallet } from "./hooks/useWallet";
import { SwapPanel } from "./components/SwapPanel";
import { BridgePanel } from "./components/BridgePanel";
import { mainnetSwap, robinhoodSwap, isSwapChainLive } from "./config/swap";
import { bridgeChains } from "./config/bridge";
import { directBridgeConfig } from "./config/directBridge";

type Tab = "swap" | "rh-swap" | "bridge";

export default function App() {
  const [tab, setTab] = useState<Tab>("swap");
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const wallet = useWallet();
  const liveBridgeCount = bridgeChains.filter((chain) => !chain.pending).length;
  const isSwapTab = tab === "swap" || tab === "rh-swap";
  const activeSwapConfig = tab === "rh-swap" ? robinhoodSwap : mainnetSwap;
  const rhLive = isSwapChainLive(robinhoodSwap);

  // One wallet -> connect straight away; several -> let the user pick.
  const handleConnect = () => {
    if (wallet.wallets.length <= 1) {
      void wallet.connect();
    } else {
      setShowWalletPicker(true);
    }
  };
  const pickWallet = (rdns: string) => {
    setShowWalletPicker(false);
    void wallet.connect(rdns);
  };

  return (
    <>
      {showWalletPicker ? (
        <div
          className="wallet-modal-overlay"
          onClick={() => setShowWalletPicker(false)}
        >
          <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wallet-modal-head">
              <strong>Connect a wallet</strong>
              <button
                type="button"
                className="wallet-modal-close"
                onClick={() => setShowWalletPicker(false)}
              >
                ✕
              </button>
            </div>
            {wallet.wallets.map((w) => (
              <button
                key={w.info.rdns}
                type="button"
                className="wallet-option"
                onClick={() => pickWallet(w.info.rdns)}
              >
                {w.info.icon ? (
                  <img src={w.info.icon} alt="" width={24} height={24} />
                ) : (
                  <span className="wallet-option-dot" />
                )}
                <span>{w.info.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
          Swap &amp; bridge with a <span className="accent">transparent fee.</span>
        </h1>
        <p className="lede">
          You keep your funds until you sign. Live quotes, slippage protection,
          and output sent straight to your wallet — no custody, no operator
          float. Bridge ETH to <strong>Robinhood Chain</strong> via the canonical
          Arbitrum Inbox, or route across <strong>{liveBridgeCount} chains</strong> via Relay.
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
          className={`tab ${tab === "rh-swap" ? "tab-active" : ""}`}
          onClick={() => setTab("rh-swap")}
        >
          Robinhood Chain Swap {rhLive ? "(Live)" : "(Soon)"}
        </button>
        <button
          type="button"
          className={`tab ${tab === "bridge" ? "tab-active" : ""}`}
          onClick={() => setTab("bridge")}
        >
          Bridge (Live)
        </button>
      </div>

      <section className="wallet-bar">
        <div className="wallet-bar-copy">
          <span className="wallet-strip-label">Connected wallet</span>
          <strong>{wallet.account ? shortAddress(wallet.account) : "Not connected"}</strong>
          <p>
            {wallet.account
              ? `${wallet.chainName || "Unknown chain"} · ${
                  wallet.isBalanceLoading
                    ? "reading balance..."
                    : wallet.nativeBalanceFormatted && wallet.nativeSymbol
                      ? `${wallet.nativeBalanceFormatted} ${wallet.nativeSymbol}`
                      : "balance unavailable"
                }`
              : "Connect MetaMask or Rabby to read balance and prepare a live swap or bridge."}
          </p>
        </div>
        <div className="wallet-bar-actions">
          {wallet.account ? (
            <button
              type="button"
              className="secondary-button wallet-action"
              onClick={() => void wallet.refreshWalletState()}
            >
              Refresh balance
            </button>
          ) : (
            <button
              type="button"
              className="secondary-button wallet-action"
              disabled={wallet.isConnecting}
              onClick={handleConnect}
            >
              {wallet.isConnecting ? "Connecting..." : "Connect wallet"}
            </button>
          )}
        </div>
      </section>

      {wallet.error ? <p className="page-error">{wallet.error}</p> : null}

      {isSwapTab ? (
        <section className="grid">
          <article className="card bridge-card">
            <SwapPanel
              config={activeSwapConfig}
              account={wallet.account}
              chainId={wallet.chainId}
              walletBalance={wallet.nativeBalanceFormatted}
              walletSymbol={wallet.nativeSymbol}
              walletChainName={wallet.chainName}
              balanceLoading={wallet.isBalanceLoading}
              onConnect={handleConnect}
              isConnecting={wallet.isConnecting}
            />
          </article>
          <article className="card">
            <h3>How the fee works · {activeSwapConfig.chainName}</h3>
            <ul className="facts">
              <li>You send ETH to the FeeRouter contract.</li>
              <li>It skims a transparent {activeSwapConfig.feeBps / 100}% fee.</li>
              <li>The rest is swapped on a SwapRouter02-style router.</li>
              <li>Output token lands directly in your wallet.</li>
              <li>Non-custodial: no operator float, no custody.</li>
              <li>Fee cap is hard-coded at 1% in the contract.</li>
              {activeSwapConfig.key === "robinhood" && !isSwapChainLive(activeSwapConfig) ? (
                <li>
                  Robinhood Chain {activeSwapConfig.chainId}: enables once the
                  FeeRouter is deployed and v3 pools are wired.
                </li>
              ) : null}
            </ul>
          </article>
        </section>
      ) : (
        <section className="grid">
          <article className="card bridge-card">
            <BridgePanel
              account={wallet.account}
              chainId={wallet.chainId}
              walletBalance={wallet.nativeBalanceFormatted}
              walletSymbol={wallet.nativeSymbol}
              walletChainName={wallet.chainName}
              balanceLoading={wallet.isBalanceLoading}
              onConnect={handleConnect}
              isConnecting={wallet.isConnecting}
            />
          </article>
          <article className="card">
            <h3>Bridge to Robinhood Chain</h3>
            <ul className="facts">
              <li>Direct bridge: canonical Arbitrum Inbox deposit on L1.</li>
              <li>Trustless: ETH lands as native ETH on Robinhood Chain.</li>
              <li>No relayer dependency — uses Arbitrum's built-in bridge.</li>
              <li>Multichain: {liveBridgeCount} Relay-enabled chains also available.</li>
              <li>Non-custodial: no operator float, no custody.</li>
              <li>Your Robinhood Chain balance shown live in the panel.</li>
              <li>
                Optional fee-skim wrapper (DirectBridgeFeeRouter) scaffolded,
                disabled until Robinhood Inbox allowlist opens.
              </li>
            </ul>
            <p className="route-note">{directBridgeConfig.activationBlocker}</p>
          </article>
        </section>
      )}
      </main>

      <footer className="site-footer">
        <span>ryswap · non-custodial fee swap</span>
        <span>
          Contract:{" "}
          <a
            href={`${mainnetSwap.explorerAddressBase}${mainnetSwap.feeRouter}`}
            target="_blank"
            rel="noreferrer"
          >
            {shortAddress(mainnetSwap.feeRouter)}
          </a>
        </span>
      </footer>
    </>
  );
}
