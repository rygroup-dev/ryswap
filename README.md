# Robinhood rbETH Bridge

Fee-first, non-custodial bridge frontend for routing user deposits into `rbETH` on Robinhood Chain `4663`.

This project is intentionally designed around one constraint:

- no custodial inventory
- no operator-funded liquidity float
- no manual treasury top-ups to fulfill user withdrawals

Users bring their own capital, sign their own transactions, and receive `rbETH` directly to their wallet on the destination chain. The product monetizes through a configurable platform fee.

## Product Direction

- Source asset: ETH
- Destination asset: rbETH on Robinhood Chain `4663`
- Delivery model: pass-through bridge flow
- Monetization: routing/platform fee in basis points
- Custody model: non-custodial

## Current Scope

This repository currently contains:

- project scaffold
- architecture docs
- fee model config
- initial UI skeleton for the bridge surface

The next implementation phase is:

1. finalize the active ETH -> rbETH bridge path
2. integrate wallet connectivity
3. execute quote + fee calculation
4. wire deposit / status tracking

## Runtime

```bash
npm install
npm run dev
```

## Environment

Copy `.env.example` to `.env` and set:

- `VITE_FEE_BPS`
- `VITE_FEE_RECIPIENT`
- `VITE_RBETH_ADDRESS`
- `VITE_TARGET_CHAIN_RPC`

## Notes

- Do not treat the old `robobridge` implementation as source-of-truth.
- Treat Robinhood Chain `4663` as a live ecosystem target, but verify each bridge path independently.
- The app should stay operational even if a given quote/bridge route is temporarily disabled.
