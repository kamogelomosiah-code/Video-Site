import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { useFetch } from '../lib/utils';
import { Alert, Spinner, cx } from '../components/ui';

type Day = { day: string; visitors: number; pv: number; videoViews: number; clicks: number; signups: number; likes: number };
type Report = {
  days: number; from: string; to: string;
  series: Day[];
  totals: Record<string, number>;
  before: Record<string, number>;
  rates: { pagesPerVisit: number; clickRate: number; returningShare: number; signupRate: number; gateConversion: number; mobileShare: number };
  topVideos: Array<{ id: string; title: string; views: number; clicks: number; ctr: number; likes: number }>;
  topSearches: Array<{ q: string; count: number; zero: number }>;
  zeroSearches: Array<{ q: string; count: number; zero: number }>;
  referrers: Array<{ host: string; count: number }>;
};

// One series per chart, in one hue (brand amber, the step that passes the dark-surface checks).
const MARK = '#d97706';
const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : Math.round(n).toLocaleString());
const pct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`;
const shortDay = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** A headline number with its change against the period before. */
function Stat({ label, value, now, before, hint }: { label: string; value: string; now?: number; before?: number; hint?: string }) {
  const change = before !== undefined && now !== undefined && before > 0 ? (now - before) / before : null;
  const Icon = change === null || Math.abs(change) < 0.005 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4" data-testid="stat">
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
        {change !== null ? (
          <><Icon className={cx('h-3.5 w-3.5', change > 0.005 ? 'text-emerald-400' : change < -0.005 ? 'text-red-400' : 'text-zinc-500')} aria-hidden />
          <span className="text-zinc-300">{change > 0 ? '+' : ''}{(change * 100).toFixed(0)}%</span> vs previous period</>
        ) : hint ? hint : <span>no earlier data</span>}
      </p>
    </div>
  );
}

/** A daily line with a soft fill. Hover (or arrow keys) shows the day's value; there is a table view too. */
function DailyChart({ title, data, field }: { title: string; data: Day[]; field: keyof Day }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(300);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const h = 160, padL = 36, padR = 8, padT = 10, padB = 22;
  const vals = data.map((d) => Number(d[field]) || 0);
  const max = Math.max(1, ...vals);
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / p) * p; })();
  const x = (i: number) => padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (w - padL - padR));
  const y = (v: number) => padT + (1 - v / nice) * (h - padT - padB);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = `${line}L${x(vals.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const total = vals.reduce((a, b) => a + b, 0);
  const pick = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const i = Math.round(((clientX - r.left - padL) / (w - padL - padR)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const hi = hover ?? null;
  return (
    <section className="min-w-0 rounded-2xl border border-zinc-900 bg-zinc-950 p-4" aria-label={title} data-testid="daily-chart">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" onClick={() => setTable((t) => !t)} className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">{table ? 'Show chart' : 'Show table'}</button>
      </div>
      <p className="mb-2 text-xs text-zinc-500">{fmt(total)} in total{hi !== null ? '' : ` · most on ${shortDay(data[vals.indexOf(Math.max(...vals))]?.day || data[0].day)}`}</p>
      {table ? (
        <div className="max-h-48 overflow-y-auto text-sm">
          <table className="w-full"><tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.day} className="border-b border-zinc-900"><td className="py-1 text-zinc-400">{shortDay(d.day)}</td><td className="py-1 text-right tabular-nums">{fmt(Number(d[field]) || 0)}</td></tr>
            ))}
          </tbody></table>
        </div>
      ) : (
        <div
          ref={wrap}
          className="relative w-full touch-pan-y outline-none"
          tabIndex={0}
          role="img"
          aria-label={`${title}: ${fmt(total)} over ${data.length} days`}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setHover((v) => Math.max(0, (v ?? data.length) - 1));
            if (e.key === 'ArrowRight') setHover((v) => Math.min(data.length - 1, (v ?? -1) + 1));
          }}
          onBlur={() => setHover(null)}
        >
          {/* The drawing takes the box's width (measured), so it fits any screen. */}
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="block">
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y(nice * t)} y2={y(nice * t)} stroke="#27272a" strokeWidth={1} />
                <text x={padL - 6} y={y(nice * t) + 4} textAnchor="end" fontSize="10" fill="#71717a">{fmt(nice * t)}</text>
              </g>
            ))}
            {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((i) => (
              <text key={i} x={x(i)} y={h - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="10" fill="#71717a">{shortDay(data[i].day)}</text>
            ))}
            <path d={area} fill={MARK} opacity={0.14} />
            <path d={line} fill="none" stroke={MARK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hi !== null && (
              <>
                <line x1={x(hi)} x2={x(hi)} y1={padT} y2={y(0)} stroke="#a1a1aa" strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={x(hi)} cy={y(vals[hi])} r={4.5} fill={MARK} stroke="#09090b" strokeWidth={2} />
              </>
            )}
          </svg>
          {hi !== null && (
            <div className="pointer-events-none absolute top-0 rounded-lg border border-zinc-800 bg-zinc-950/95 px-2.5 py-1.5 text-xs shadow-xl" style={{ left: Math.min(Math.max(x(hi) - 50, 0), w - 110) }} role="status">
              <span className="block text-sm font-bold tabular-nums text-zinc-50">{fmt(vals[hi])}</span>
              <span className="text-zinc-400">{shortDay(data[hi].day)}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Visitors → video views → click-outs → sign-ups: how far people get. */
function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <section className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4" aria-label="Funnel" data-testid="funnel">
      <h3 className="mb-3 text-sm font-semibold">From visit to video</h3>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-zinc-300">{s.label}</span>
              <span className="tabular-nums"><b className="text-zinc-50">{fmt(s.value)}</b>{i > 0 && steps[i - 1].value > 0 && s.value <= steps[i - 1].value && <span className="ml-2 text-xs text-zinc-500">{pct(s.value / steps[i - 1].value)} of previous</span>}</span>
            </div>
            <div className="h-2.5 rounded-full bg-zinc-900"><div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (s.value / max) * 100)}%`, background: MARK }} /></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function List({ title, rows, empty, testid }: { title: string; rows: Array<{ label: string; value: string; sub?: string }>; empty: string; testid?: string }) {
  return (
    <section className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4" data-testid={testid}>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <ol className="divide-y divide-zinc-900 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-3 py-2">
              <span className="w-5 shrink-0 text-xs tabular-nums text-zinc-600">{i + 1}</span>
              <span className="min-w-0 flex-1"><span className="line-clamp-1">{r.label}</span>{r.sub && <span className="block text-xs text-zinc-500">{r.sub}</span>}</span>
              <span className="shrink-0 tabular-nums text-zinc-200">{r.value}</span>
            </li>
          ))}
        </ol>
      ) : <p className="py-4 text-sm text-zinc-500">{empty}</p>}
    </section>
  );
}

export default function Analytics() {
  usePageTitle('Admin · Analytics');
  const [days, setDays] = useState(30);
  const { data, loading, error } = useFetch(() => api.get<Report>(`/admin/analytics?days=${days}`), [days]);
  const t = data?.totals || {};
  const b = data?.before || {};
  return (
    <div className="space-y-5" data-testid="analytics">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-zinc-400">Real visitors only (bots and admins aren’t counted). No cookies, no outside trackers.</p>
        </div>
        <div className="flex rounded-full bg-zinc-900 p-1 text-sm" role="tablist" aria-label="Period">
          {[7, 14, 30, 90].map((d) => (
            <button key={d} type="button" role="tab" aria-selected={days === d} onClick={() => setDays(d)} className={cx('ripple h-9 rounded-full px-3.5 font-medium transition-colors', days === d ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-white')}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {loading && !data ? <Spinner /> : data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Visitors" value={fmt(t.uniqueVisitors)} now={t.visitors} before={b.visitors} />
            <Stat label="Page views" value={fmt(t.pv)} now={t.pv} before={b.pv} />
            <Stat label="Video views" value={fmt(t.videoViews)} now={t.videoViews} before={b.videoViews} />
            <Stat label="Click-outs to videos" value={fmt(t.clicks)} now={t.clicks} before={b.clicks} />
            <Stat label="Pages per visit" value={data.rates.pagesPerVisit.toFixed(1)} hint={`${fmt(t.sessions)} visits`} />
            <Stat label="Returning visitors" value={pct(data.rates.returningShare)} hint={`${fmt(t.returning)} came back`} />
            <Stat label="Sign-ups" value={fmt(t.signups)} now={t.signups} before={b.signups} />
            <Stat label="Watch click rate" value={pct(data.rates.clickRate)} hint="video views that went on to watch" />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <DailyChart title="Visitors per day" data={data.series} field="visitors" />
            <DailyChart title="Video views per day" data={data.series} field="videoViews" />
            <DailyChart title="Click-outs per day" data={data.series} field="clicks" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Funnel steps={[
              { label: 'Visitors', value: t.uniqueVisitors },
              { label: 'Opened a video', value: t.videoViews },
              { label: 'Asked to sign up', value: t.gateShown },
              { label: 'Signed up', value: t.signups },
              { label: 'Went to watch', value: t.clicks },
            ]} />
            <section className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
              <h3 className="mb-3 text-sm font-semibold">Engagement</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><dt className="text-zinc-400">Sign-up rate</dt><dd className="text-lg font-bold tabular-nums">{pct(data.rates.signupRate)}</dd></div>
                <div><dt className="text-zinc-400">Sign-up box → account</dt><dd className="text-lg font-bold tabular-nums">{pct(data.rates.gateConversion)}</dd></div>
                <div><dt className="text-zinc-400">Likes / dislikes</dt><dd className="text-lg font-bold tabular-nums">{fmt(t.likes)} / {fmt(t.dislikes)}</dd></div>
                <div><dt className="text-zinc-400">Searches</dt><dd className="text-lg font-bold tabular-nums">{fmt(t.searches)} <span className="text-xs font-normal text-zinc-500">({t.searches ? pct(t.zeroSearches / t.searches) : '0%'} found nothing)</span></dd></div>
                <div><dt className="text-zinc-400">On phones</dt><dd className="text-lg font-bold tabular-nums">{pct(data.rates.mobileShare)}</dd></div>
                <div><dt className="text-zinc-400">New visitors</dt><dd className="text-lg font-bold tabular-nums">{fmt(t.newVisitors)}</dd></div>
              </dl>
            </section>
          </div>

          <List
            title="Top videos"
            testid="top-videos"
            empty="No video views yet."
            rows={data.topVideos.map((v) => ({ label: v.title, value: `${fmt(v.views)} views`, sub: `${fmt(v.clicks)} click-outs · ${pct(v.ctr)} click rate · ${fmt(v.likes)} likes` }))}
          />
          <div className="grid gap-3 lg:grid-cols-3">
            <List title="What people search for" testid="top-searches" empty="No searches yet." rows={data.topSearches.map((s) => ({ label: s.q, value: fmt(s.count) }))} />
            <List title="Searches that found nothing" testid="zero-searches" empty="Every search found something." rows={data.zeroSearches.map((s) => ({ label: s.q, value: fmt(s.zero), sub: 'add videos for this' }))} />
            <List title="Where visitors come from" testid="referrers" empty="No visits yet." rows={data.referrers.map((r) => ({ label: r.host === 'direct' ? 'Direct / bookmarks' : r.host, value: fmt(r.count) }))} />
          </div>
        </>
      )}
    </div>
  );
}
