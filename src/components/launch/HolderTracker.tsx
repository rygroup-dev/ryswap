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
