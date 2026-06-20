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
