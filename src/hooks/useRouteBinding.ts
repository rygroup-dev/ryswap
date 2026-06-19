import { useMemo } from "react";
import { hasBindableRoute, routeCandidates } from "../config/routes";

export function useRouteBinding() {
  return useMemo(
    () => ({
      candidates: routeCandidates,
      hasBindableRoute: hasBindableRoute(),
      liveExecutionReady: false,
      blocker:
        "No public reproducible ETH -> rbETH route is confirmed yet. Current evidence shows Relay is disabled and rbETH minting appears custom."
    }),
    []
  );
}
