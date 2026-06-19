# Route Audit

## Snapshot

Date: 2026-06-19 UTC

Target: `ETH -> rbETH` on Robinhood-style chain `4663`

## Confirmed Findings

### 1. Relay legacy route is disabled

- `https://api.relay.link/config/v2?originChainId=1&destinationChainId=4663&...`
  returned `enabled: false`
- `POST https://api.relay.link/quote`
  returned `CHAIN_DISABLED` for:
  - `1 -> 4663`
  - `4663 -> 1`

Verdict:

- do not bind v1 to Relay for `4663`
- old `robobridge` flow is not a viable production dependency

### 2. `rbETH` is live, but current mint evidence points to a custom owner-minted token

Token:

- address: `0x9c497572F6Ab96Cb6859EcDb0FBAD87F852c8F35`
- name: `Robinhood Bridged ETH`
- symbol: `rbETH`

Explorer evidence:

- creation transaction:
  `0xfea3632d4a0b1e704c7f651dfd4a08c96ac631cf4b0495b41e3c55884c68e752`
- creator address:
  `0x263371bf95a2ca5C249221b3c14D98AB3D3b4C22`
- observed mint transaction:
  `0xb138a9e9d82ef1b46dd22e0b1cec015c8cc802ab956a42d822fa7622d43fbf32`
- mint recipient:
  `0xe019c3Bd3B64c2C207a70fB166707CCA9bB6758e`
- mint method selector:
  `0x4c148905`

Verdict:

- `rbETH` is not currently proven to come from a public canonical bridge path
- current on-chain evidence is consistent with a custom owner-controlled mint flow

### 3. Robinhood `4663` DEX infra is publicly visible, but it is swap infra, not bridge infra

Reverse-engineered from public front-end bundle:

- source: `https://fun.noxa.fi/assets/index-DSL9CgJ2.js`
- chain key: `robinhood`
- DEX family: Uniswap-style V3

Observed addresses:

- router:
  `0xCaf681a66D020601342297493863E78C959E5cb2`
- quoter:
  `0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7`
- factory:
  `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA`
- position manager:
  `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3`

Selector decoding from creator-wallet transactions:

- `0x5ae401dc` -> `multicall(uint256,bytes[])`
- `0x04e45aaf` -> `exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))`
- `0x5023b4df` -> `exactOutputSingle((address,address,uint24,address,uint256,uint256,uint160))`
- `0x49404b7c` -> `unwrapWETH9(uint256,address)`
- `0x12210e8a` -> `refundETH()`
- `0x4c148905` -> unknown / custom / unregistered selector

Interpretation:

- public Robinhood `4663` liquidity and swap infra is real and reusable
- creator-wallet activity clearly touches swap infrastructure
- but the `rbETH` mint path still does not resolve to a public bridge ABI or route
- if we later build our own route, this DEX infra can still be useful on the destination side
  for liquidity handling, quoting, or exit paths

### 4. `rbETH` contract surface looks like a gated custom mint controller

Reverse-engineered from runtime bytecode, storage, and live calls:

- owner slot:
  `slot0 -> 0x263371bf95a2ca5C249221b3c14D98AB3D3b4C22`
- paused state:
  `paused() -> false`
- constructor argument in `slot2`:
  `0x0de0b6b3a7640000` = `1e18`
- known public/admin surface:
  - `owner()` -> `0x263371bf95a2ca5C249221b3c14D98AB3D3b4C22`
  - `paused()` -> `false`
  - `pause()`
  - `unpause()`
  - `setMinter(address,bool)`
  - `minters(address)`
  - `BPS_DENOMINATOR()` -> `10000`

Verified by live calls:

- `minters(0x263371bf95a2ca5C249221b3c14D98AB3D3b4C22) -> true`
- `minters(0xbCA5227b1d3da8381E4baCd41263885F8831Be9E) -> false`

Observed event signatures:

- `Paused(address)`
- `MinterUpdated(address,bool)`
- standard `Transfer(address,address,uint256)`
- at least two additional custom events remain unregistered in public signature DBs

Mint-path hypothesis:

- the mint transaction selector `0x4c148905` is still unregistered / custom
- transaction calldata shape strongly suggests a route keyed by:
  - request or message id (`bytes32`)
  - recipient (`address`)
  - amount (`uint256`)
  - extra numeric field (`uint256`)
  - extra address field (`address`)
- combined with:
  - `minters(address)` gate
  - `pause()` / `unpause()`
  - custom events

This is consistent with a private or operator-controlled bridge/mint controller rather than
an open public bridge interface.

### 5. Operator workflow signal is now visible on-chain

Observed sequence:

1. owner funded helper EOA
   - tx: `0x6e6ce89aeb6bb82e805dc1035abb3bbbc6208daf530cfe9224bddc0e7ed9c45b`
   - from:
     `0x263371bf95a2ca5C249221b3c14D98AB3D3b4C22`
   - to:
     `0x16d3cf5B04Bc473BDd1f9AA785B311c38E81231F`
   - value:
     `0.01 ETH`

2. owner whitelisted helper EOA as minter
   - tx:
     `0x9fff159f984998a1f280aa1e281db47099c64baeb0ec94b61369970675b11119`
   - decoded call:
     `setMinter(0x16d3cf5B04Bc473BDd1f9AA785B311c38E81231F, true)`

3. owner executed custom mint route
   - tx:
     `0xb138a9e9d82ef1b46dd22e0b1cec015c8cc802ab956a42d822fa7622d43fbf32`
   - selector:
     `0x4c148905`

4. request id is queryable on-chain
   - calling:
     `0x40c5faf0 + requestId`
   - with request id from the mint tx:
     `0x2265b442158e0069f3894b3383431c2c84205822e0856913453a0339c3dec88a`
   - returns:
     `true`

Interpretation:

- `0x40c5faf0` is very likely a processed/used request-id checker
- the contract appears to enforce anti-replay / idempotency for mint requests
- this is bridge-controller behavior, but still private/custom rather than publicly documented

### 6. Another unknown getter returns a global mint-size-like constant

Calling selector:

- `0x60132c9c(address)`

returns the same value for arbitrary addresses:

- `0x0de0b6b3a7640000` = `1e18`

Observed on:

- owner address
- whitelisted helper EOA
- random address
- mint recipient

Interpretation:

- this selector does not behave like `balanceOf`
- it likely exposes a fixed unit/config such as:
  - claim size
  - mint unit
  - per-request base amount

## Product Impact

This project can safely proceed as:

- fee-first
- non-custodial
- route-audited

## Additional Signal: Creator Wallet Behavior

Creator address:

- `0x263371bf95a2ca5C249221b3c14D98AB3D3b4C22`

Observed activity:

- created `rbETH`
- minted `rbETH` to `0xe019c3Bd3B64c2C207a70fB166707CCA9bB6758e`
- also used verified `SwapRouter02`
  (`0xCaf681a66D020601342297493863E78C959E5cb2`)
- traded tokens such as:
  - `STONKS`
  - `KITSU`
  - `NORMIE`

Interpretation:

- the current `rbETH` creator wallet behaves more like an active ecosystem wallet/operator
  than a publicly documented bridge controller
- this strengthens the case that the visible `rbETH` flow is custom/private and not
  a public bridge route we can safely integrate today

But execution must stay in "prepared" mode until one of these becomes true:

1. a public canonical/custom bridge route is identified and reproducible
2. the owner/operator of the current `rbETH` mint flow exposes an integrable route
3. a new trust-minimized route is built and adopted by the ecosystem

## Immediate Next Step

- keep execution preparation and fee logic in place
- surface route binding status in the UI
- do not claim live bridging until the actual route is confirmed
