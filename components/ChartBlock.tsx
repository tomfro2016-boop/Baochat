'use client';

// Vẽ biểu đồ từ khối ```chart (JSON) do AI sinh ra. Không phụ thuộc thư viện ngoài.
type Series = { name?: string; values: number[] };
type Spec = { type: 'bar' | 'line' | 'pie'; title?: string; labels: string[]; series: Series[] };

const COLORS = ['#F0A528', '#4DA3A0', '#C8553D', '#7A8CC2', '#8FB569', '#B8869E'];

export function parseChart(raw: string): Spec | null {
  try {
    const j = JSON.parse(raw);
    const type = j.type === 'line' || j.type === 'pie' ? j.type : 'bar';
    let labels: string[] = [];
    let series: Series[] = [];
    if (Array.isArray(j.data)) {
      labels = j.data.map((d: any) => String(d.label ?? d.name ?? ''));
      series = [{ values: j.data.map((d: any) => Number(d.value)) }];
    } else if (Array.isArray(j.labels) && Array.isArray(j.series)) {
      labels = j.labels.map(String);
      series = j.series.map((s: any) => ({ name: s.name ? String(s.name) : undefined, values: (s.values || []).map(Number) }));
    } else return null;
    if (!labels.length || !series.length || series.some((s) => s.values.some((v) => !Number.isFinite(v)))) return null;
    return { type, title: j.title ? String(j.title) : undefined, labels: labels.slice(0, 24), series: series.slice(0, 6) };
  } catch {
    return null;
  }
}

const nf = (v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString('vi-VN') : String(Math.round(v * 100) / 100));

export default function ChartBlock({ spec }: { spec: Spec }) {
  const W = 560, H = 260, pl = 44, pr = 12, pt = 14, pb = 34;
  const n = spec.labels.length;
  const legend = spec.type === 'pie' ? spec.labels : spec.series.map((s, i) => s.name || `#${i + 1}`);
  let body: React.ReactNode;

  if (spec.type === 'pie') {
    const vals = spec.series[0].values.map((v) => Math.max(0, v));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    let a0 = -Math.PI / 2;
    const cx = 130, cy = 130, r = 100;
    body = (
      <svg viewBox="0 0 560 260" className="w-full">
        {vals.map((v, i) => {
          const a1 = a0 + (v / total) * Math.PI * 2;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const d = v / total > 0.9999
            ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
            : `M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`;
          a0 = a1;
          return <path key={i} d={d} fill={COLORS[i % COLORS.length]} stroke="var(--surface)" strokeWidth={2} />;
        })}
        {vals.map((v, i) => (
          <g key={i} transform={`translate(270 ${20 + i * 22})`}>
            <rect width={10} height={10} y={-9} rx={2} fill={COLORS[i % COLORS.length]} />
            <text x={16} fontSize={12} fill="var(--ink)">{spec.labels[i]} · {nf(v)} ({Math.round((v / total) * 100)}%)</text>
          </g>
        ))}
      </svg>
    );
  } else {
    const all = spec.series.flatMap((s) => s.values);
    const max = Math.max(0, ...all);
    const min = Math.min(0, ...all);
    const span = max - min || 1;
    const iw = W - pl - pr, ih = H - pt - pb;
    const y = (v: number) => pt + ih - ((v - min) / span) * ih;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + span * t);
    const gw = iw / n;
    const bw = Math.min(40, (gw * 0.7) / spec.series.length);
    body = (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pl - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--muted)">{nf(t)}</text>
          </g>
        ))}
        {spec.labels.map((l, i) => (
          <text key={i} x={pl + gw * i + gw / 2} y={H - 12} textAnchor="middle" fontSize={10} fill="var(--muted)">{l.length > 10 ? l.slice(0, 9) + '…' : l}</text>
        ))}
        {spec.type === 'bar' &&
          spec.series.map((s, si) =>
            s.values.map((v, i) => {
              const x = pl + gw * i + gw / 2 - (bw * spec.series.length) / 2 + bw * si;
              const y0 = y(0), y1 = y(v);
              return (
                <rect key={`${si}-${i}`} x={x} y={Math.min(y0, y1)} width={bw - 2} height={Math.abs(y0 - y1)} rx={2} fill={COLORS[si % COLORS.length]}>
                  <title>{`${spec.labels[i]}: ${nf(v)}`}</title>
                </rect>
              );
            }),
          )}
        {spec.type === 'line' &&
          spec.series.map((s, si) => (
            <g key={si}>
              <polyline fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth={2} points={s.values.map((v, i) => `${pl + gw * i + gw / 2},${y(v)}`).join(' ')} />
              {s.values.map((v, i) => (
                <circle key={i} cx={pl + gw * i + gw / 2} cy={y(v)} r={3.5} fill={COLORS[si % COLORS.length]}>
                  <title>{`${spec.labels[i]}: ${nf(v)}`}</title>
                </circle>
              ))}
            </g>
          ))}
      </svg>
    );
  }

  return (
    <figure className="my-3 rounded-lg border border-line bg-surface p-4">
      {spec.title && <figcaption className="mono-label mb-2">{spec.title}</figcaption>}
      {body}
      {spec.type !== 'pie' && spec.series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
          {legend.map((l, i) => (
            <span key={i} className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />{l}</span>
          ))}
        </div>
      )}
    </figure>
  );
}
