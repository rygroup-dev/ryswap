# Ry HooD Launchpad — Frontend MVP (mock data) — Design

**Date:** 2026-06-20
**Status:** Approved (brainstorming) → pending implementation plan
**Repo:** `robinhood-rbeth-bridge` (GitHub `rygroup-dev/ryswap`), deployed as Ry HooD on Vercel

## Context & decisions

Ry HooD already ships **Swap** (Ethereum + Robinhood Chain 4663) and **Bridge**
tabs. We are adding a **pump.fun-style meme-coin launchpad** (reference:
`fun.noxa.fi/robinhood`, `marian-tracker.vercel.app`).

Decisions locked in brainstorming:

- **Own launchpad** (our own bonding-curve + token-factory contracts on 4663) is
  the end goal — NOT fronting noxa's contracts.
- **Build the FRONTEND FIRST against mock data.** The on-chain contracts
  (sub-project A) are deferred; they will also be gas-blocked until the 4663
  deployer wallet is funded. Building the UI now keeps work productive.
- This spec covers **only the frontend MVP with a mock data provider.** The
  smart contracts get their own later spec.

### Hard dependency / non-goal
- No real on-chain reads/writes in this MVP. Everything runs against an
  in-browser mock provider. Wallet connect is reused but no launchpad tx is sent.
- Graduation to a real Uniswap V3 pool is **simulated** (state flips to
  `graduated`); actual liquidity migration is a contract concern, out of scope.

## Goals

1. A new **"Launch"** tab with four screens: token **feed**, **create coin**,
   per-token **trade page**, and **holder tracker + live activity**.
2. A clean **data-layer abstraction** so swapping mock → real contracts later is
   a provider swap, not a UI rewrite.
3. **Real, tested bonding-curve math** shared between the mock now and the
   contract integration later (so nothing is throwaway).

## Architecture

### Module layout (new `src/launchpad/`)
- `types.ts` — `LaunchToken`, `Trade`, `Holder`, `CurveState`, `LaunchpadProvider`.
- `bondingCurve.ts` — **pure** math (no React, no I/O). Constant-product virtual
  reserves. Functions: `priceOf(curve)`, `buy(curve, ethIn) -> {tokensOut, curve'}`,
  `sell(curve, tokensIn) -> {ethOut, curve'}`, `marketCap(curve)`,
  `graduationProgress(curve) -> 0..1`. Unit-tested (TDD).
- `provider.ts` — the `LaunchpadProvider` interface the UI depends on:
  `listTokens(filter)`, `getToken(id)`, `createToken(draft)`, `buy(id, ethIn)`,
  `sell(id, tokensIn)`, `subscribe(cb)` (for live updates).
- `mockProvider.ts` — implements `LaunchpadProvider`. Backed by `localStorage`,
  seeded with a few demo coins + trade history, plus an optional interval
  "simulator" that injects random trades so the activity feed/king-of-the-hill
  feel alive. Buy/sell call `bondingCurve.ts` to update reserves, append a
  `Trade`, and update `holders`.
- `index.ts` — exports the active provider (mock for now): `export const launchpad = mockProvider;`

### UI components (new `src/components/launch/`)
- `LaunchTab.tsx` — owns view state `feed | create | token`, renders the right
  screen (state-based routing, matching the app's existing no-router pattern).
- `LaunchFeed.tsx` — Trending / New / Graduated tabs; grid of `TokenCard`s.
- `TokenCard.tsx` — logo, name/ticker, mcap, price, bonding-curve progress bar.
- `CreateCoin.tsx` — form (name, ticker, logo URL, description, optional socials)
  + live preview card; mock submit creates a token and routes to its page.
- `TokenPage.tsx` — price chart (derived from trade history), buy/sell panel
  (uses `bondingCurve` for live quote + slippage display), graduation progress,
  supply/holders summary; embeds `HolderTracker` + `ActivityFeed`.
- `HolderTracker.tsx` — holder distribution list/bars (marian-tracker style).
- `ActivityFeed.tsx` — recent trades + "king of the hill" (top mcap, non-graduated).

### App integration
- `App.tsx`: add `"launch"` to the `Tab` union and a tab button "Launch".
  Render `<LaunchTab />` when active. Existing wallet bar stays (used for the
  connected-address display; no launchpad tx in MVP).

## Data model (mock)

```
CurveState   { ethReserve, tokenReserve, virtualEth, virtualToken, soldSupply }
LaunchToken  { id, address?, name, ticker, image, description, socials?,
               creator, createdAt, curve: CurveState, totalSupply,
               graduated: boolean, holders: Holder[], trades: Trade[] }
Trade        { id, kind: 'buy'|'sell', account, ethAmount, tokenAmount,
               priceAfter, ts }
Holder       { account, balance, pct }
```

## Bonding curve (mock parameters, tunable)

- Total supply: 1,000,000,000 (1B) tokens.
- ~800M tokens sold via the curve; remainder reserved for graduation liquidity.
- Constant-product virtual reserves (`k = ethReserve * tokenReserve`), price =
  `ethReserve / tokenReserve`.
- Graduation triggers at a target raised-ETH threshold (parameter, small for the
  cheap 4663 chain). On graduation: `graduated = true`, token moves to the
  "Graduated" feed; (real liquidity migration is out of scope here).
- These constants live in one config object so they can be matched to the
  contracts later.

## Data flow

UI → `launchpad` provider (mock) → `localStorage` store. Buy/sell mutate the
curve via `bondingCurve.ts`, append a `Trade`, recompute `holders`, then notify
subscribers → feed/activity/chart re-render. Chart series is derived from
`trades[].priceAfter`.

## Error handling

- Create form validation: required name/ticker, ticker length (≤ 10), valid
  image URL, dedupe ticker against existing mock tokens.
- Buy/sell: reject non-positive amounts; show simulated "pending → confirmed"
  state so the flow mirrors a real tx.
- Provider calls are async (return Promises) even in mock, so the UI is already
  written for real network latency.

## Testing

- `bondingCurve.ts` — unit tests (TDD): price monotonicity, buy then sell
  round-trip bounds, k-invariant, graduation threshold, no negative reserves.
- `mockProvider.ts` — a couple of tests for create/buy/sell/persistence.
- Components — verified via `npm run build` + manual smoke in `npm run dev`.

## Isolation check

- UI depends ONLY on the `LaunchpadProvider` interface and `bondingCurve` pure
  functions — never on `mockProvider` internals or `localStorage` directly.
- Swapping to on-chain later = implement `chainLaunchpad` against the same
  interface and change one export in `index.ts`. No component changes expected.

## Out of scope (later specs)

- Smart contracts (factory + bonding curve + graduation) — sub-project A.
- Real wallet transactions, real chart data feed, comments/social chat,
  image upload/hosting (MVP uses image URLs).
