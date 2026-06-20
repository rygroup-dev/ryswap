export function Sparkline({ points, height = 80 }: { points: number[]; height?: number }) {
  if (points.length < 2) {
    return <div className="sparkline-empty">Not enough trades to chart yet.</div>;
  }
  const width = 320;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / span) * (height - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={up ? "#34d399" : "#ff6b6b"} strokeWidth="2" />
    </svg>
  );
}
