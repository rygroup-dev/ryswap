import { useMemo } from "react";
import { hasBindableRoute, routeCandidates } from "../config/routes";

export function useRouteBinding() {
  return useMemo(
    () => ({
      candidates: routeCandidates,
      hasBindableRoute: hasBindableRoute(),
      liveExecutionReady: hasBindableRoute(),
      blocker: hasBindableRoute()
        ? null
        : "No public reproducible ETH -> Robinhood route is confirmed yet.",
    }),
    []
  );
}
