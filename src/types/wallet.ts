export type EthereumRequestArgs = {
  method: string;
  params?: unknown[] | object;
};

export type EthereumProvider = {
  isMetaMask?: boolean;
  request: <T = unknown>(args: EthereumRequestArgs) => Promise<T>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
