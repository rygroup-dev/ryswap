# Architecture

## Objective

Build a non-custodial bridge product where users deposit on the source side and receive `rbETH` on Robinhood Chain `4663`, while the operator captures a platform fee without warehousing destination-side liquidity.

## Core Principle

The app must not depend on operator inventory.

That means:

- no custodial hot wallet used to fulfill user bridge output
- no market-making float required to complete user deposits
- no “instant bridge” promise backed by treasury funds

Instead, the app should route users through an on-chain bridge path that mints or releases the destination asset directly to the user.

## System Shape

### 1. Frontend

Responsibilities:

- wallet connect
- chain detection / switching
- amount entry
- fee preview
- route health display
- transaction status tracking

### 2. Quote Layer

Responsibilities:

- evaluate bridge route availability
- estimate platform fee
- estimate destination output
- expose warnings when route health is degraded

This can start as a frontend-only module and later move behind an API if route discovery becomes more complex.

### 3. Bridge Execution Layer

Responsibilities:

- prepare deposit transaction data
- encode fee split rules
- ensure destination receiver is the end user
- track bridge lifecycle state

### 4. Optional Lightweight Backend

Needed only if one of these becomes necessary:

- route discovery requires private API keys
- bridge proofs / message status polling becomes expensive
- analytics or fee attribution needs server-side persistence

## Preferred v1 Transaction Model

1. User connects wallet on source chain.
2. User enters ETH amount.
3. App computes:
   - gross amount
   - platform fee
   - net bridge amount
   - expected `rbETH` out
4. User signs deposit transaction.
5. Canonical/custom bridge path executes.
6. User receives `rbETH` directly on `4663`.
7. Fee is routed to project fee recipient.

## Fee Model

Recommended launch range:

- `30 bps` to `100 bps`

Why:

- low enough to stay competitive
- high enough to matter on meaningful size
- easy to communicate in UI

### Fee Capture Options

#### Option A: Fee Before Bridge

- user sends gross amount
- app routes fee portion to fee recipient
- net amount is bridged

Pros:

- simplest accounting
- no custody of destination asset

Cons:

- bridge output is slightly lower than input expectation
- requires very clear fee disclosure

#### Option B: Fee On Destination Asset

- full amount bridged
- fee is skimmed from destination release/mint

Pros:

- cleaner source-side input UX

Cons:

- only possible if route contract design supports it
- more integration risk

### Recommended v1 Choice

Start with **Option A: fee before bridge**, unless the active `ETH -> rbETH` path exposes a safer, native fee hook.

## Chain Assumptions

- destination chain id: `4663`
- destination asset: `rbETH`
- destination chain flavor: Arbitrum Nitro / Orbit-like
- ecosystem explorer: `so-explorer.poptyedev.com`

## Open Questions

1. Which production path is the real live route for `ETH -> rbETH`?
2. Is `rbETH` minted by canonical bridge logic or by a community wrapper?
3. Can the fee be collected inside the route, or should it be split before bridge execution?
4. Do we need a backend for route-health monitoring and analytics in v1?
