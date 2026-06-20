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
