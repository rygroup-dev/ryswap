import { useCallback, useMemo, useState } from "react";
import { prepareBridgeExecution } from "../lib/executionPlan";
import type { BridgeQuote, PreparedBridgeExecution } from "../types/bridge";

export function useBridgeExecution(quote: BridgeQuote) {
  const [prepared, setPrepared] = useState<PreparedBridgeExecution | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prepare = useCallback(() => {
    try {
      const next = prepareBridgeExecution(String(quote.grossEthIn));
      setPrepared(next);
      setError(null);
      return next;
    } catch (err) {
      setPrepared(null);
      setError(err instanceof Error ? err.message : "Failed to prepare bridge execution.");
      return null;
    }
  }, [quote.grossEthIn]);

  const clear = useCallback(() => {
    setPrepared(null);
    setError(null);
  }, []);

  return useMemo(
    () => ({
      prepared,
      error,
      prepare,
      clear
    }),
    [prepared, error, prepare, clear]
  );
}
