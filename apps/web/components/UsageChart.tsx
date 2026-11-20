import type { DailyUsage } from "@/lib/mock";

// Server-rendered SVG bar chart. No chart library.
export function UsageChart({ data }: { data: DailyUsage[] }) {
  const W = 640, H = 200, pad = 24;
  const max = Math.max(...data.map((d) => d.calls), 1);
  const bw = (W - pad * 2) / data.length;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-labelledby="chart-t" className="w-full">
        <title id="chart-t">Daily tool calls this month. Peak {max} calls.</title>
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad} x2={W - pad} y1={H - t * (H - pad)} y2={H - t * (H - pad)}
            stroke="var(--border)" strokeWidth="1" />
        ))}
        {data.map((d, i) => {
          const h = (d.calls / max) * (H - pad);
          return (
            <rect key={d.date} x={pad + i * bw + 1} y={H - h} width={Math.max(bw - 2, 1)} height={h}
              rx="2" fill="var(--accent)">
              <title>{`${d.date}: ${d.calls} calls`}</title>
            </rect>
          );
        })}
        <text x={pad} y={H + 16} fontSize="11" fill="var(--muted)">{data[0].date.slice(5)}</text>
        <text x={W - pad} y={H + 16} fontSize="11" textAnchor="end" fill="var(--muted)">
          {data[data.length - 1].date.slice(5)}
        </text>
        <text x={pad} y={12} fontSize="11" fill="var(--muted)">{max}</text>
      </svg>
      <figcaption className="sr-only">Bar chart of calls per day</figcaption>
    </figure>
  );
}
