# Ry HooD Launchpad Frontend (mock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pump.fun-style launchpad UI in Ry HooD (feed, create coin, token trade page, holder tracker + activity) against a mock data provider, with real tested bonding-curve math.

**Architecture:** A new `src/launchpad/` data layer (pure `bondingCurve.ts`, a `LaunchpadProvider` interface, a localStorage-backed `mockProvider`) and `src/components/launch/` UI. UI depends only on the provider interface + pure curve math, so swapping to on-chain later is a provider swap.

**Tech Stack:** React 18 + TypeScript + Vite. Vitest for unit tests (added in Task 1). No new runtime deps (charts done with inline SVG).

**Spec:** `docs/superpowers/specs/2026-06-20-ryhood-launchpad-frontend-design.md`

---

## File structure

- `src/launchpad/types.ts` — shared types + `LaunchpadProvider` interface.
- `src/launchpad/bondingCurve.ts` — pure constant-product virtual-reserve math + `CURVE` config.
- `src/launchpad/bondingCurve.test.ts` — curve unit tests.
- `src/launchpad/mockProvider.ts` — localStorage-backed provider + seed + simulator.
- `src/launchpad/mockProvider.test.ts` — provider tests.
- `src/launchpad/index.ts` — exports active provider (`launchpad`).
- `src/components/launch/LaunchTab.tsx` — view-state router (feed | create | token).
- `src/components/launch/TokenCard.tsx` — feed card.
- `src/components/launch/LaunchFeed.tsx` — filter tabs + grid.
- `src/components/launch/CreateCoin.tsx` — create form + preview.
- `src/components/launch/Sparkline.tsx` — inline-SVG price chart.
- `src/components/launch/TokenPage.tsx` — chart + buy/sell + graduation + embeds tracker/feed.
- `src/components/launch/HolderTracker.tsx` — holder distribution.
- `src/components/launch/ActivityFeed.tsx` — recent trades + king of the hill.
- `src/App.tsx` — add `"launch"` tab.
- `src/styles.css` — launchpad styles (appended).
- `package.json`, `vitest.config.ts` — test runner (Task 1).

---

## Task 1: Add Vitest test runner

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts + devDependencies)
- Create: `src/launchpad/smoke.test.ts` (temporary, deleted in step 6)

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest@^2.1.0`
Expected: adds vitest to devDependencies, exits 0.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add test script to `package.json`**

In the `"scripts"` object add:

```json
    "test": "vitest run"
```

(Place it after `"preview": "vite preview",` — keep valid JSON.)

- [ ] **Step 4: Create a temporary smoke test `src/launchpad/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests to verify the runner works**

Run: `npm test`
Expected: PASS, 1 passed.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm src/launchpad/smoke.test.ts
git add package.json vitest.config.ts package-lock.json
git commit -m "chore: add vitest test runner"
```

---

## Task 2: Bonding curve types + math (TDD)

**Files:**
- Create: `src/launchpad/types.ts`
- Create: `src/launchpad/bondingCurve.ts`
- Test: `src/launchpad/bondingCurve.test.ts`

- [ ] **Step 1: Create `src/launchpad/types.ts`**

```ts
export type CurveState = {
  ethReserve: number; // real ETH collected so far
  tokenReserve: number; // tokens still in the curve (y)
  virtualEth: number; // virtual ETH reserve offset (x0)
  virtualToken: number; // virtual token reserve (y0) — constant
  soldSupply: number; // tokens sold out of the curve
};

export type Trade = {
  id: string;
  kind: "buy" | "sell";
  account: string;
  ethAmount: number;
  tokenAmount: number;
  priceAfter: number;
  ts: number;
};

export type Holder = { account: string; balance: number; pct: number };

export type Socials = { x?: string; telegram?: string; website?: string };

export type LaunchToken = {
  id: string;
  name: string;
  ticker: string;
  image: string;
  description: string;
  socials?: Socials;
  creator: string;
  createdAt: number;
  curve: CurveState;
  totalSupply: number;
  graduated: boolean;
  holders: Holder[];
  trades: Trade[];
};

export type TokenDraft = {
  name: string;
  ticker: string;
  image: string;
  description: string;
  socials?: Socials;
  creator: string;
};

export type FeedFilter = "trending" | "new" | "graduated";

export interface LaunchpadProvider {
  listTokens(filter: FeedFilter): Promise<LaunchToken[]>;
  getToken(id: string): Promise<LaunchToken | null>;
  createToken(draft: TokenDraft): Promise<LaunchToken>;
  buy(id: string, ethIn: number, account: string): Promise<LaunchToken>;
  sell(id: string, tokensIn: number, account: string): Promise<LaunchToken>;
  subscribe(cb: () => void): () => void;
}
```

- [ ] **Step 2: Write the failing test `src/launchpad/bondingCurve.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  CURVE,
  initialCurve,
  priceOf,
  buy,
  sell,
  marketCap,
  graduationProgress,
  isGraduated,
} from "./bondingCurve";

describe("bondingCurve", () => {
  it("initial price = virtualEth / curveSupply", () => {
    const c = initialCurve();
    expect(priceOf(c)).toBeCloseTo(CURVE.virtualEth / CURVE.curveSupply, 18);
  });

  it("buy raises price and lowers tokenReserve", () => {
    const c0 = initialCurve();
    const { tokensOut, curve } = buy(c0, 1);
    expect(tokensOut).toBeGreaterThan(0);
    expect(curve.tokenReserve).toBeLessThan(c0.tokenReserve);
    expect(priceOf(curve)).toBeGreaterThan(priceOf(c0));
    expect(curve.soldSupply).toBeCloseTo(tokensOut, 6);
  });

  it("preserves the constant product k across a buy", () => {
    const c0 = initialCurve();
    const k0 = (c0.virtualEth + c0.ethReserve) * c0.tokenReserve;
    const { curve } = buy(c0, 2);
    const k1 = (curve.virtualEth + curve.ethReserve) * curve.tokenReserve;
    expect(k1).toBeCloseTo(k0, 6);
  });

  it("buy then sell the same tokens returns ~the eth in", () => {
    const c0 = initialCurve();
    const { tokensOut, curve: c1 } = buy(c0, 1);
    const { ethOut } = sell(c1, tokensOut);
    expect(ethOut).toBeCloseTo(1, 6);
  });

  it("graduationProgress hits 1 at the graduation target", () => {
    const c = { ...initialCurve(), ethReserve: CURVE.graduationEth };
    expect(graduationProgress(c)).toBe(1);
    expect(isGraduated(c)).toBe(true);
  });

  it("marketCap is price * totalSupply", () => {
    const c = initialCurve();
    expect(marketCap(c)).toBeCloseTo(priceOf(c) * CURVE.totalSupply, 12);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- bondingCurve`
Expected: FAIL ("Failed to resolve import ./bondingCurve").

- [ ] **Step 4: Implement `src/launchpad/bondingCurve.ts`**

```ts
import type { CurveState } from "./types";

// Tunable launchpad economics. Kept in one object so the eventual on-chain
// contracts can mirror these exact numbers.
export const CURVE = {
  totalSupply: 1_000_000_000, // 1B total token supply
  curveSupply: 800_000_000, // tokens sold through the curve
  virtualEth: 1.0, // virtual ETH reserve offset (x0)
  graduationEth: 4.0, // real ETH raised to graduate to the DEX
};

// Constant-product virtual reserves:
//   x = virtualEth + ethReserve   (effective ETH)
//   y = tokenReserve              (effective token reserve)
//   k = x * y is invariant; virtualToken = curveSupply = initial y.
export function initialCurve(): CurveState {
  return {
    ethReserve: 0,
    tokenReserve: CURVE.curveSupply,
    virtualEth: CURVE.virtualEth,
    virtualToken: CURVE.curveSupply,
    soldSupply: 0,
  };
}

function k(c: CurveState): number {
  return c.virtualEth * c.virtualToken;
}

export function priceOf(c: CurveState): number {
  return (c.virtualEth + c.ethReserve) / c.tokenReserve;
}

export function buy(c: CurveState, ethIn: number): { tokensOut: number; curve: CurveState } {
  const x = c.virtualEth + c.ethReserve;
  const newX = x + ethIn;
  const newY = k(c) / newX;
  const tokensOut = c.tokenReserve - newY;
  return {
    tokensOut,
    curve: {
      ...c,
      ethReserve: c.ethReserve + ethIn,
      tokenReserve: newY,
      soldSupply: c.soldSupply + tokensOut,
    },
  };
}

export function sell(c: CurveState, tokensIn: number): { ethOut: number; curve: CurveState } {
  const x = c.virtualEth + c.ethReserve;
  const newY = c.tokenReserve + tokensIn;
  const newX = k(c) / newY;
  const ethOut = x - newX;
  return {
    ethOut,
    curve: {
      ...c,
      ethReserve: c.ethReserve - ethOut,
      tokenReserve: newY,
      soldSupply: c.soldSupply - tokensIn,
    },
  };
}

export function marketCap(c: CurveState): number {
  return priceOf(c) * CURVE.totalSupply;
}

export function graduationProgress(c: CurveState): number {
  return Math.min(c.ethReserve / CURVE.graduationEth, 1);
}

export function isGraduated(c: CurveState): boolean {
  return c.ethReserve >= CURVE.graduationEth;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- bondingCurve`
Expected: PASS, 6 passed.

- [ ] **Step 6: Commit**

```bash
git add src/launchpad/types.ts src/launchpad/bondingCurve.ts src/launchpad/bondingCurve.test.ts
git commit -m "feat(launchpad): bonding curve math + types"
```

---

## Task 3: Mock provider (TDD)

**Files:**
- Create: `src/launchpad/mockProvider.ts`
- Create: `src/launchpad/index.ts`
- Test: `src/launchpad/mockProvider.test.ts`

- [ ] **Step 1: Write the failing test `src/launchpad/mockProvider.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createMockLaunchpad } from "./mockProvider";

// jsdom-free: provide a tiny localStorage shim for the node test env.
class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe("mockProvider", () => {
  let lp: ReturnType<typeof createMockLaunchpad>;
  beforeEach(() => {
    lp = createMockLaunchpad(new MemStore() as unknown as Storage, { seed: false, simulate: false });
  });

  it("creates a token with an initial curve", async () => {
    const t = await lp.createToken({
      name: "Test", ticker: "TST", image: "", description: "", creator: "0xabc",
    });
    expect(t.ticker).toBe("TST");
    expect(t.curve.ethReserve).toBe(0);
    expect(t.graduated).toBe(false);
    expect(await lp.getToken(t.id)).not.toBeNull();
  });

  it("buy increases the creator's holder balance and adds a trade", async () => {
    const t = await lp.createToken({
      name: "Test", ticker: "TST", image: "", description: "", creator: "0xabc",
    });
    const after = await lp.buy(t.id, 0.5, "0xbuyer");
    expect(after.trades.length).toBe(1);
    expect(after.trades[0].kind).toBe("buy");
    const holder = after.holders.find((h) => h.account === "0xbuyer");
    expect(holder).toBeTruthy();
    expect(holder!.balance).toBeGreaterThan(0);
    expect(after.curve.ethReserve).toBeCloseTo(0.5, 9);
  });

  it("sell reduces balance and eth reserve", async () => {
    const t = await lp.createToken({
      name: "Test", ticker: "TST", image: "", description: "", creator: "0xabc",
    });
    const bought = await lp.buy(t.id, 1, "0xbuyer");
    const bal = bought.holders.find((h) => h.account === "0xbuyer")!.balance;
    const sold = await lp.sell(t.id, bal / 2, "0xbuyer");
    expect(sold.holders.find((h) => h.account === "0xbuyer")!.balance).toBeCloseTo(bal / 2, 6);
    expect(sold.curve.ethReserve).toBeLessThan(bought.curve.ethReserve);
  });

  it("graduates when eth reserve crosses the target", async () => {
    const t = await lp.createToken({
      name: "Big", ticker: "BIG", image: "", description: "", creator: "0xabc",
    });
    const after = await lp.buy(t.id, 10, "0xwhale");
    expect(after.graduated).toBe(true);
    const graduated = await lp.listTokens("graduated");
    expect(graduated.some((x) => x.id === t.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- mockProvider`
Expected: FAIL ("Failed to resolve import ./mockProvider").

- [ ] **Step 3: Implement `src/launchpad/mockProvider.ts`**

```ts
import {
  buy as curveBuy,
  sell as curveSell,
  initialCurve,
  isGraduated,
  priceOf,
} from "./bondingCurve";
import type {
  FeedFilter,
  Holder,
  LaunchpadProvider,
  LaunchToken,
  TokenDraft,
  Trade,
} from "./types";

const STORAGE_KEY = "ryhood-launchpad-tokens";

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function recomputeHolders(token: LaunchToken): Holder[] {
  const balances = new Map<string, number>();
  for (const t of token.trades) {
    const prev = balances.get(t.account) ?? 0;
    balances.set(t.account, prev + (t.kind === "buy" ? t.tokenAmount : -t.tokenAmount));
  }
  const live = [...balances.entries()].filter(([, b]) => b > 1e-9);
  const total = live.reduce((s, [, b]) => s + b, 0) || 1;
  return live
    .map(([account, balance]) => ({ account, balance, pct: (balance / total) * 100 }))
    .sort((a, b) => b.balance - a.balance);
}

export type MockOptions = { seed?: boolean; simulate?: boolean };

export function createMockLaunchpad(
  store: Storage,
  options: MockOptions = { seed: true, simulate: true }
): LaunchpadProvider & { stopSimulator: () => void } {
  const listeners = new Set<() => void>();
  let tokens: LaunchToken[] = load();

  function load(): LaunchToken[] {
    try {
      const raw = store.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function persist() {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } catch {
      /* ignore quota */
    }
    for (const l of listeners) l();
  }

  function newToken(draft: TokenDraft): LaunchToken {
    return {
      id: uid(),
      name: draft.name,
      ticker: draft.ticker.toUpperCase(),
      image: draft.image,
      description: draft.description,
      socials: draft.socials,
      creator: draft.creator,
      createdAt: Date.now(),
      curve: initialCurve(),
      totalSupply: 1_000_000_000,
      graduated: false,
      holders: [],
      trades: [],
    };
  }

  if (options.seed && tokens.length === 0) {
    const seeds: TokenDraft[] = [
      { name: "Robin Hood", ticker: "RHOOD", image: "", description: "First mover on Ry HooD.", creator: "0xseed1" },
      { name: "Lady Marian", ticker: "MARIAN", image: "", description: "For the people of 4663.", creator: "0xseed2" },
      { name: "Green Arrow", ticker: "ARROW", image: "", description: "Straight to graduation.", creator: "0xseed3" },
    ];
    tokens = seeds.map(newToken);
    // give the seeds some history so the feed isn't empty
    for (const t of tokens) {
      const eth = 0.2 + Math.random();
      const { tokensOut, curve } = curveBuy(t.curve, eth);
      t.curve = curve;
      t.trades.push({ id: uid(), kind: "buy", account: t.creator, ethAmount: eth, tokenAmount: tokensOut, priceAfter: priceOf(curve), ts: Date.now() });
      t.holders = recomputeHolders(t);
    }
    persist();
  }

  function get(id: string): LaunchToken | undefined {
    return tokens.find((t) => t.id === id);
  }

  async function listTokens(filter: FeedFilter): Promise<LaunchToken[]> {
    const live = tokens.filter((t) => (filter === "graduated" ? t.graduated : !t.graduated));
    if (filter === "new") return [...live].sort((a, b) => b.createdAt - a.createdAt);
    if (filter === "graduated") return [...live].sort((a, b) => b.curve.ethReserve - a.curve.ethReserve);
    // trending = highest eth raised
    return [...live].sort((a, b) => b.curve.ethReserve - a.curve.ethReserve);
  }

  async function getToken(id: string): Promise<LaunchToken | null> {
    return get(id) ?? null;
  }

  async function createToken(draft: TokenDraft): Promise<LaunchToken> {
    const t = newToken(draft);
    tokens = [t, ...tokens];
    persist();
    return t;
  }

  function applyTrade(id: string, kind: "buy" | "sell", account: string, eth: number, tok: number) {
    const t = get(id);
    if (!t) throw new Error("token not found");
    const trade: Trade = {
      id: uid(), kind, account, ethAmount: eth, tokenAmount: tok, priceAfter: priceOf(t.curve), ts: Date.now(),
    };
    t.trades = [...t.trades, trade];
    t.holders = recomputeHolders(t);
    if (!t.graduated && isGraduated(t.curve)) t.graduated = true;
    persist();
    return t;
  }

  async function buy(id: string, ethIn: number, account: string): Promise<LaunchToken> {
    const t = get(id);
    if (!t) throw new Error("token not found");
    if (ethIn <= 0) throw new Error("amount must be positive");
    const { tokensOut, curve } = curveBuy(t.curve, ethIn);
    t.curve = curve;
    return applyTrade(id, "buy", account, ethIn, tokensOut);
  }

  async function sell(id: string, tokensIn: number, account: string): Promise<LaunchToken> {
    const t = get(id);
    if (!t) throw new Error("token not found");
    if (tokensIn <= 0) throw new Error("amount must be positive");
    const { ethOut, curve } = curveSell(t.curve, tokensIn);
    t.curve = curve;
    return applyTrade(id, "sell", account, ethOut, tokensIn);
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  if (options.simulate && typeof setInterval !== "undefined") {
    timer = setInterval(() => {
      const open = tokens.filter((t) => !t.graduated);
      if (!open.length) return;
      const t = open[Math.floor(Math.random() * open.length)];
      void buy(t.id, 0.01 + Math.random() * 0.05, "0x" + uid().padEnd(40, "0").slice(0, 40));
    }, 6000);
  }
  function stopSimulator() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { listTokens, getToken, createToken, buy, sell, subscribe, stopSimulator };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- mockProvider`
Expected: PASS, 4 passed.

- [ ] **Step 5: Create `src/launchpad/index.ts`**

```ts
import { createMockLaunchpad } from "./mockProvider";

// Active provider. Swap this line for a chain-backed provider once the
// launchpad contracts are deployed on 4663.
export const launchpad =
  typeof window !== "undefined"
    ? createMockLaunchpad(window.localStorage)
    : createMockLaunchpad({
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      } as unknown as Storage, { seed: false, simulate: false });

export * from "./types";
```

- [ ] **Step 6: Commit**

```bash
git add src/launchpad/mockProvider.ts src/launchpad/mockProvider.test.ts src/launchpad/index.ts
git commit -m "feat(launchpad): localStorage mock provider + seed/simulator"
```

---

## Task 4: Launch tab shell + App integration

**Files:**
- Create: `src/components/launch/LaunchTab.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/launch/LaunchTab.tsx`**

```tsx
import { useState } from "react";
import { LaunchFeed } from "./LaunchFeed";
import { CreateCoin } from "./CreateCoin";
import { TokenPage } from "./TokenPage";

type View =
  | { name: "feed" }
  | { name: "create" }
  | { name: "token"; id: string };

export function LaunchTab({ account }: { account: string | null }) {
  const [view, setView] = useState<View>({ name: "feed" });

  if (view.name === "create") {
    return (
      <CreateCoin
        account={account}
        onCancel={() => setView({ name: "feed" })}
        onCreated={(id) => setView({ name: "token", id })}
      />
    );
  }
  if (view.name === "token") {
    return (
      <TokenPage
        id={view.id}
        account={account}
        onBack={() => setView({ name: "feed" })}
      />
    );
  }
  return (
    <LaunchFeed
      onCreate={() => setView({ name: "create" })}
      onOpen={(id) => setView({ name: "token", id })}
    />
  );
}
```

- [ ] **Step 2: Add the `"launch"` tab to `src/App.tsx`**

Change the `Tab` type (currently `type Tab = "swap" | "rh-swap" | "bridge";`) to:

```tsx
type Tab = "swap" | "rh-swap" | "launch" | "bridge";
```

- [ ] **Step 3: Import LaunchTab in `src/App.tsx`**

Add after the `BridgePanel` import:

```tsx
import { LaunchTab } from "./components/launch/LaunchTab";
```

- [ ] **Step 4: Add the tab button in `src/App.tsx`**

Immediately after the `rh-swap` tab button's closing `</button>`, add:

```tsx
        <button
          type="button"
          className={`tab ${tab === "launch" ? "tab-active" : ""}`}
          onClick={() => setTab("launch")}
        >
          Launch
        </button>
```

- [ ] **Step 5: Render the launch view in `src/App.tsx`**

Find the content conditional `{isSwapTab ? ( ... ) : (` ... bridge ... `)}`. Replace the
opening `{isSwapTab ? (` with a three-way branch by changing the bridge `: (`
into `: tab === "launch" ? (` block followed by the bridge `: (`. Concretely,
right before the final bridge `) : (` section, insert this branch so the
structure becomes `isSwapTab ? (swap) : tab === "launch" ? (launch) : (bridge)`:

```tsx
      ) : tab === "launch" ? (
        <LaunchTab account={wallet.account} />
      ) : (
```

(The existing `{isSwapTab ? (` opening and the final bridge `)}` stay; only the
middle `) : (` separating swap from bridge becomes the `) : tab === "launch" ? ( ... ) : (` above.)

- [ ] **Step 6: Build to verify wiring (components stubbed next tasks may not exist yet)**

Because LaunchFeed/CreateCoin/TokenPage are created in later tasks, create minimal placeholder files NOW so the build passes, then flesh them out:

Create `src/components/launch/LaunchFeed.tsx`:
```tsx
export function LaunchFeed({ onCreate, onOpen }: { onCreate: () => void; onOpen: (id: string) => void }) {
  return <div className="card" onClick={() => onOpen("")}>Feed placeholder <button onClick={onCreate}>Create</button></div>;
}
```
Create `src/components/launch/CreateCoin.tsx`:
```tsx
export function CreateCoin({ account, onCancel, onCreated }: { account: string | null; onCancel: () => void; onCreated: (id: string) => void }) {
  return <div className="card">Create placeholder {account} <button onClick={onCancel}>x</button><button onClick={() => onCreated("")}>ok</button></div>;
}
```
Create `src/components/launch/TokenPage.tsx`:
```tsx
export function TokenPage({ id, account, onBack }: { id: string; account: string | null; onBack: () => void }) {
  return <div className="card">Token {id} {account} <button onClick={onBack}>back</button></div>;
}
```

Run: `npm run build`
Expected: PASS (build succeeds).

- [ ] **Step 7: Commit**

```bash
git add src/components/launch/ src/App.tsx
git commit -m "feat(launchpad): Launch tab shell + App integration (placeholders)"
```

---

## Task 5: Feed + token card

**Files:**
- Create: `src/components/launch/TokenCard.tsx`
- Modify (replace placeholder): `src/components/launch/LaunchFeed.tsx`

- [ ] **Step 1: Create `src/components/launch/TokenCard.tsx`**

```tsx
import { marketCap, graduationProgress } from "../../launchpad/bondingCurve";
import type { LaunchToken } from "../../launchpad";

function fmtUsdish(eth: number): string {
  return eth >= 1 ? `${eth.toFixed(2)} ETH` : `${eth.toFixed(4)} ETH`;
}

export function TokenCard({ token, onClick }: { token: LaunchToken; onClick: () => void }) {
  const pct = Math.round(graduationProgress(token.curve) * 100);
  return (
    <button type="button" className="launch-card" onClick={onClick}>
      <div className="launch-card-head">
        <span className="launch-logo">{token.ticker.slice(0, 2)}</span>
        <div>
          <strong>{token.name}</strong>
          <span className="launch-ticker">${token.ticker}</span>
        </div>
      </div>
      <p className="launch-desc">{token.description || "—"}</p>
      <div className="launch-stats">
        <span>mcap ~{fmtUsdish(marketCap(token.curve))}</span>
        <span>{token.graduated ? "graduated ✨" : `${pct}%`}</span>
      </div>
      <div className="launch-progress">
        <div className="launch-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Replace `src/components/launch/LaunchFeed.tsx`**

```tsx
import { useEffect, useState } from "react";
import { launchpad, type FeedFilter, type LaunchToken } from "../../launchpad";
import { TokenCard } from "./TokenCard";

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "new", label: "New" },
  { key: "graduated", label: "Graduated" },
];

export function LaunchFeed({
  onCreate,
  onOpen,
}: {
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<FeedFilter>("trending");
  const [tokens, setTokens] = useState<LaunchToken[]>([]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void launchpad.listTokens(filter).then((t) => {
        if (active) setTokens(t);
      });
    };
    refresh();
    const unsub = launchpad.subscribe(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, [filter]);

  return (
    <section className="launch-wrap">
      <div className="launch-toolbar">
        <div className="launch-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`tab ${filter === f.key ? "tab-active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" className="primary-button launch-create-btn" onClick={onCreate}>
          + Create coin
        </button>
      </div>
      {tokens.length === 0 ? (
        <p className="execution-note">No coins here yet. Be the first — create one.</p>
      ) : (
        <div className="launch-grid">
          {tokens.map((t) => (
            <TokenCard key={t.id} token={t} onClick={() => onOpen(t.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/launch/TokenCard.tsx src/components/launch/LaunchFeed.tsx
git commit -m "feat(launchpad): token feed + cards"
```

---

## Task 6: Create coin form

**Files:**
- Modify (replace placeholder): `src/components/launch/CreateCoin.tsx`

- [ ] **Step 1: Replace `src/components/launch/CreateCoin.tsx`**

```tsx
import { useState } from "react";
import { launchpad } from "../../launchpad";

export function CreateCoin({
  account,
  onCancel,
  onCreated,
}: {
  account: string | null;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    if (!/^[A-Za-z0-9]{1,10}$/.test(ticker.trim()))
      return setError("Ticker must be 1–10 letters/numbers.");
    if (image && !/^https?:\/\//.test(image.trim()))
      return setError("Image must be a valid http(s) URL.");
    setBusy(true);
    try {
      const token = await launchpad.createToken({
        name: name.trim(),
        ticker: ticker.trim(),
        image: image.trim(),
        description: description.trim(),
        creator: account || "0xanon",
      });
      onCreated(token.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create.");
      setBusy(false);
    }
  };

  return (
    <section className="grid">
      <article className="card bridge-card">
        <div className="card-head">
          <div>
            <p className="label">Launch · Robinhood Chain</p>
            <h2>Create a coin</h2>
          </div>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Back
          </button>
        </div>

        <label className="input-wrap">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Robin Hood" />
        </label>
        <label className="input-wrap">
          <span>Ticker</span>
          <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="RHOOD" maxLength={10} />
        </label>
        <label className="input-wrap">
          <span>Logo image URL (optional)</span>
          <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
        </label>
        <label className="input-wrap">
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's the meme?" />
        </label>

        {error ? <p className="error-text">{error}</p> : null}

        <button type="button" className="primary-button" disabled={busy} onClick={() => void submit()}>
          {busy ? "Launching…" : "Launch coin"}
        </button>
        <p className="execution-note">Mock launch — no on-chain transaction yet.</p>
      </article>

      <article className="card">
        <h3>Preview</h3>
        <div className="launch-card preview">
          <div className="launch-card-head">
            <span className="launch-logo">{(ticker || "?").slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{name || "Your coin"}</strong>
              <span className="launch-ticker">${(ticker || "TICKER").toUpperCase()}</span>
            </div>
          </div>
          <p className="launch-desc">{description || "Your description here."}</p>
        </div>
      </article>
    </section>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/launch/CreateCoin.tsx
git commit -m "feat(launchpad): create coin form + preview"
```

---

## Task 7: Sparkline chart

**Files:**
- Create: `src/components/launch/Sparkline.tsx`

- [ ] **Step 1: Create `src/components/launch/Sparkline.tsx`**

```tsx
export function Sparkline({ points, height = 80 }: { points: number[]; height?: number }) {
  if (points.length < 2) {
    return <div className="sparkline-empty">Not enough trades to chart yet.</div>;
  }
  const width = 320;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / span) * (height - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={up ? "#34d399" : "#ff6b6b"} strokeWidth="2" />
    </svg>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: PASS (component unused yet — that's fine; it's imported in Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/components/launch/Sparkline.tsx
git commit -m "feat(launchpad): inline svg sparkline chart"
```

---

## Task 8: Holder tracker + activity feed

**Files:**
- Create: `src/components/launch/HolderTracker.tsx`
- Create: `src/components/launch/ActivityFeed.tsx`

- [ ] **Step 1: Create `src/components/launch/HolderTracker.tsx`**

```tsx
import type { Holder } from "../../launchpad";

function short(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function HolderTracker({ holders }: { holders: Holder[] }) {
  if (!holders.length) return <p className="execution-note">No holders yet.</p>;
  return (
    <div className="holder-list">
      {holders.slice(0, 10).map((h) => (
        <div key={h.account} className="holder-row">
          <span>{short(h.account)}</span>
          <div className="holder-bar">
            <div className="holder-bar-fill" style={{ width: `${Math.min(h.pct, 100)}%` }} />
          </div>
          <strong>{h.pct.toFixed(1)}%</strong>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/launch/ActivityFeed.tsx`**

```tsx
import type { Trade } from "../../launchpad";

function short(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
function ago(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

export function ActivityFeed({ trades }: { trades: Trade[] }) {
  if (!trades.length) return <p className="execution-note">No trades yet.</p>;
  const recent = [...trades].slice(-12).reverse();
  return (
    <div className="activity-list">
      {recent.map((t) => (
        <div key={t.id} className={`activity-row ${t.kind}`}>
          <span>{t.kind === "buy" ? "🟢 buy" : "🔴 sell"}</span>
          <span>{short(t.account)}</span>
          <span>{t.ethAmount.toFixed(4)} ETH</span>
          <span>{ago(t.ts)} ago</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/launch/HolderTracker.tsx src/components/launch/ActivityFeed.tsx
git commit -m "feat(launchpad): holder tracker + activity feed"
```

---

## Task 9: Token page (chart + buy/sell + graduation)

**Files:**
- Modify (replace placeholder): `src/components/launch/TokenPage.tsx`

- [ ] **Step 1: Replace `src/components/launch/TokenPage.tsx`**

```tsx
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
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Run the dev server and smoke test manually**

Run: `npm run dev`, open the local URL, click the **Launch** tab. Verify: feed shows seeded coins, Create coin works and routes to the token page, Buy/Sell updates price/holders/activity, graduation bar fills.
Expected: all flows work; no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/launch/TokenPage.tsx
git commit -m "feat(launchpad): token page with chart, buy/sell, graduation"
```

---

## Task 10: Launchpad styles

**Files:**
- Modify: `src/styles.css` (append)

- [ ] **Step 1: Append launchpad styles to `src/styles.css`**

```css

/* ── Launchpad ───────────────────────────────────────────────────────── */
.launch-wrap { display: flex; flex-direction: column; gap: 18px; }
.launch-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.launch-filters { display: inline-flex; gap: 6px; padding: 6px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel-2); }
.launch-create-btn { width: auto; padding: 11px 18px; }
.launch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.launch-card { text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); color: var(--text); transition: border-color .15s ease, transform .15s ease; }
.launch-card:hover { border-color: var(--brand-2); transform: translateY(-2px); }
.launch-card.preview { cursor: default; }
.launch-card-head { display: flex; align-items: center; gap: 11px; }
.launch-logo { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font-weight: 800; color: #04110b; background: linear-gradient(135deg, var(--brand-2), var(--accent)); }
.launch-card-head strong { display: block; font-size: 15px; }
.launch-ticker { color: var(--sub); font-size: 12.5px; font-weight: 700; }
.launch-desc { color: var(--sub); font-size: 13px; margin: 0; line-height: 1.5; max-height: 40px; overflow: hidden; }
.launch-stats { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--sub); }
.launch-progress { height: 7px; border-radius: 999px; background: var(--panel-2); overflow: hidden; }
.launch-progress.big { height: 12px; margin: 8px 0; }
.launch-progress-fill { height: 100%; background: linear-gradient(90deg, var(--brand), var(--brand-2)); }
.sparkline { width: 100%; height: 90px; }
.sparkline-empty { color: var(--sub); font-size: 13px; padding: 20px 0; }
.holder-list, .activity-list { display: flex; flex-direction: column; gap: 8px; }
.holder-row { display: grid; grid-template-columns: 100px 1fr 52px; align-items: center; gap: 10px; font-size: 12.5px; color: var(--sub); }
.holder-bar { height: 8px; border-radius: 999px; background: var(--panel-2); overflow: hidden; }
.holder-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--brand-2)); }
.activity-row { display: grid; grid-template-columns: 64px 1fr 90px 48px; gap: 8px; font-size: 12.5px; color: var(--sub); padding: 6px 0; border-bottom: 1px solid var(--line); }
.activity-row.buy span:first-child { color: var(--brand-2); }
.activity-row.sell span:first-child { color: var(--danger); }
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: PASS, all curve + provider tests green.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "feat(launchpad): styles"
```

---

## Final verification

- [ ] `npm test` — all unit tests pass.
- [ ] `npm run build` — production build succeeds.
- [ ] `npm run dev` — Launch tab: feed → create → token page → buy/sell → graduation all work, no console errors.
- [ ] Push: `git push origin main`.
