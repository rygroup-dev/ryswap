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
