import { useState } from "react";
import { targetChain } from "./config/chains";
import { shortAddress } from "./lib/format";
import { useWallet } from "./hooks/useWallet";
import { SwapPanel } from "./components/SwapPanel";
import { BridgePanel } from "./components/BridgePanel";
import { swapConfig } from "./config/swap";
import { BRIDGE_FEE_BPS, bridgeChains } from "./config/bridge";

type Tab = "swap" | "bridge";

export default function App() {
  const [tab, setTab] = useState<Tab>("swap");
  const wallet = useWallet();
  const liveBridgeCount = bridgeChains.filter((chain) => !chain.pending).length;

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
          float. Wallet balance is read directly in the UI, and bridge routing
          now spans <strong>{liveBridgeCount} Relay-enabled chains</strong>. Robinhood
          Chain <strong>{targetChain.id}</strong> stays staged until Relay lists it.
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
              onClick={() => void wallet.connect()}
            >
              {wallet.isConnecting ? "Connecting..." : "Connect wallet"}
            </button>
          )}
        </div>
      </section>

      {wallet.error ? <p className="page-error">{wallet.error}</p> : null}

      {tab === "swap" ? (
        <section className="grid">
          <article className="card bridge-card">
            <SwapPanel
              account={wallet.account}
              chainId={wallet.chainId}
              walletBalance={wallet.nativeBalanceFormatted}
              walletSymbol={wallet.nativeSymbol}
              walletChainName={wallet.chainName}
              balanceLoading={wallet.isBalanceLoading}
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
            <BridgePanel
              account={wallet.account}
              chainId={wallet.chainId}
              walletBalance={wallet.nativeBalanceFormatted}
              walletSymbol={wallet.nativeSymbol}
              walletChainName={wallet.chainName}
              balanceLoading={wallet.isBalanceLoading}
              onConnect={() => void wallet.connect()}
              isConnecting={wallet.isConnecting}
            />
          </article>
          <article className="card">
            <h3>Multichain bridge</h3>
            <ul className="facts">
              <li>Routing via Relay.link aggregator.</li>
              <li>Non-custodial: relayers move funds, no operator float.</li>
              <li>Transparent {BRIDGE_FEE_BPS / 100}% bridge fee.</li>
              <li>Live: {liveBridgeCount} Relay-enabled EVM chains in the selector.</li>
              <li>Built-in slippage protection (minimum received).</li>
              <li>Robinhood Chain {targetChain.id}: auto-enables once Relay lists it.</li>
            </ul>
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
