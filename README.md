# ryswap

[![Live on Ethereum Mainnet](https://img.shields.io/badge/Ethereum-Mainnet-627EEA?logo=ethereum&logoColor=white)](https://etherscan.io/address/0xB6bEB664d3888b8E59d816203e894012727Ea83A)
[![Non-custodial](https://img.shields.io/badge/custody-non--custodial-10b981)](#how-it-works)
[![Platform fee](https://img.shields.io/badge/fee-0.3%25-blue)](#how-it-works)
[![Built with Vite](https://img.shields.io/badge/Vite-React%20%2B%20TS-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Deploy with Vercel](https://img.shields.io/badge/deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/new)

**ryswap** is a non-custodial, fee-first swap dApp. Users swap **ETH → tokens** directly on-chain through a transparent fee router. No operator float, no custody — you keep your funds until you sign, and the output lands straight in your wallet.

A staged **bridge** surface (ETH → rbETH on Robinhood Chain `4663`) ships as a preview tab.
A **single-tx direct bridge wrapper** is now scaffolded for Ethereum source-chain deployment, but must remain disabled until Robinhood opens the relevant Inbox / allowlist path.

---

## How it works

1. You send ETH to the **FeeRouter** contract.
2. It skims a transparent **0.3%** platform fee (hard-capped at 1% in the contract).
3. The remainder is swapped via **Uniswap SwapRouter02**.
4. The output token is sent **directly to your wallet**.

Live quotes come from **Uniswap QuoterV2**, and every swap is **slippage-protected** (configurable, default 1%).

### Deployed contract (Ethereum Mainnet)

| Item | Value |
|------|-------|
| FeeRouter | [`0xB6bEB664d3888b8E59d816203e894012727Ea83A`](https://etherscan.io/address/0xB6bEB664d3888b8E59d816203e894012727Ea83A) |
| Router | Uniswap SwapRouter02 |
| Quoter | Uniswap QuoterV2 |
| Platform fee | 0.30% |

---

## Features

- 🔒 **Non-custodial** — no operator inventory, no treasury float
- 💸 **Transparent fee** — 0.3%, on-chain, hard-capped at 1%
- 📈 **Live quotes** — real output estimate before you sign
- 🛡️ **Slippage protection** — minimum-received enforced on every swap
- 🔁 **Multi-token** — ETH → USDC / USDT / DAI
- 🌉 **Bridge preview** — staged rbETH path on Robinhood Chain `4663`

---

## Run locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

---

## Deploy (Vercel)

1. Import this repo at [vercel.com/new](https://vercel.com/new).
2. Framework is auto-detected (**Vite**). Defaults are correct:
   - Build: `npm run build`
   - Output: `dist`
3. (Optional) set environment variables — see below.
4. Deploy.

## Environment

Copy `.env.example` to `.env`. All values have safe defaults baked in, so the app runs without env config.

| Variable | Purpose |
|----------|---------|
| `VITE_FEE_BPS` | Platform fee in basis points (default `30` = 0.3%) |
| `VITE_FEE_RECIPIENT` | Address that receives the fee |
| `VITE_FEE_ROUTER` | Deployed FeeRouter address |
| `VITE_DIRECT_BRIDGE_FEE_BPS` | Planned direct-bridge fee in basis points (default `150` = 1.5%) |
| `VITE_DIRECT_BRIDGE_FEE_RECIPIENT` | Fee recipient for the single-tx direct bridge wrapper |
| `VITE_DIRECT_BRIDGE_INBOX` | Robinhood / Orbit Inbox address used by the wrapper |
| `VITE_DIRECT_BRIDGE_FEE_ROUTER` | Deployed DirectBridgeFeeRouter address once allowlisted |

## Direct bridge scaffold

The repository now includes a `DirectBridgeFeeRouter` contract for the future
ETH mainnet -> Robinhood direct flow:

1. User sends ETH once to the wrapper.
2. Wrapper skims the platform fee on the source chain.
3. Wrapper forwards the remaining ETH to the configured Inbox via `depositEth`.
4. Destination funds are credited to the user's Robinhood address if the Inbox accepts the caller.

Important:

- This wrapper **does not** bypass Robinhood allowlists.
- Keep the frontend route disabled until the wrapper address is explicitly allowed.
- Deploy helper: `node scripts/deploy-direct-bridge-router.mjs`

---

## Security notes

- The FeeRouter never custodies user funds beyond a single atomic transaction.
- The fee is hard-capped at 1% in the contract — the owner cannot set a predatory fee.
- Always swap from a wallet you control. Verify the contract address before signing.

## License

MIT
