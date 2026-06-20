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
    const sorted =
      filter === "new"
        ? [...live].sort((a, b) => b.createdAt - a.createdAt)
        : [...live].sort((a, b) => b.curve.ethReserve - a.curve.ethReserve);
    return sorted.map(copy);
  }

  function copy(t: LaunchToken): LaunchToken {
    return JSON.parse(JSON.stringify(t));
  }

  async function getToken(id: string): Promise<LaunchToken | null> {
    const t = get(id);
    return t ? copy(t) : null;
  }

  async function createToken(draft: TokenDraft): Promise<LaunchToken> {
    const t = newToken(draft);
    tokens = [t, ...tokens];
    persist();
    return copy(t);
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
    const result = applyTrade(id, "buy", account, ethIn, tokensOut);
    return copy(result);
  }

  async function sell(id: string, tokensIn: number, account: string): Promise<LaunchToken> {
    const t = get(id);
    if (!t) throw new Error("token not found");
    if (tokensIn <= 0) throw new Error("amount must be positive");
    const { ethOut, curve } = curveSell(t.curve, tokensIn);
    t.curve = curve;
    const result = applyTrade(id, "sell", account, ethOut, tokensIn);
    return copy(result);
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
