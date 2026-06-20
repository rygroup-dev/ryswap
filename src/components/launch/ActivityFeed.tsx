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
