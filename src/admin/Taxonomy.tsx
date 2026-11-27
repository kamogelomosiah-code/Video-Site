import { useEffect, useState } from 'react';
import { AD_SIZE_LIMITS, AD_SLOTS, adSlotSize, parseAdSizes, type AdSize, type AdUnit, type Category } from '../../shared/types';
import { api } from '../lib/api';
import { usePageTitle, useSettings } from '../lib/settings';
import { Badge, Button, Input, useToast } from '../components/ui';
import ResourceAdmin from './ResourceAdmin';

export function CategoriesAdmin() {
  usePageTitle('Admin · Categories');
  return (
    <ResourceAdmin<Category>
      title="Categories"
      description="The category chips on the home page. Keep it to a handful; each video picks one."
      endpoint="categories"
      noun="category"
      defaults={{ name: '', order: 10, active: true, tags: [] }}
      sort={(a, b) => (a.order ?? 0) - (b.order ?? 0)}
      searchText={(c) => `${c.name} ${c.slug}`}
      fields={[
        { key: 'name', label: 'Name', type: 'text', required: true, half: true },
        { key: 'order', label: 'Position', type: 'number', half: true, hint: '1 shows first.' },
        { key: 'active', label: 'Show on the site', type: 'toggle', defaultOn: true },
      ]}
      columns={[
        { label: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
        { label: 'Link name', render: (c) => <code className="text-xs text-zinc-400">{c.slug}</code> },
        { label: 'Order', render: (c) => c.order },
        { label: 'Shown', render: (c) => <Badge on={c.active !== false} yes="Shown" no="Hidden" /> },
      ]}
    />
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const running = (a: AdUnit) => a.enabled && (!a.startsAt || a.startsAt <= today()) && (!a.endsAt || a.endsAt >= today());
function schedule(a: AdUnit) {
  if (!a.enabled) return 'Paused';
  if (a.startsAt && a.startsAt > today()) return `Starts ${a.startsAt}`;
  if (a.endsAt && a.endsAt < today()) return `Ended ${a.endsAt}`;
  return a.endsAt ? `Running until ${a.endsAt}` : 'Running';
}

type Sizes = Record<string, AdSize>;
const defaultsOf = (id: string): AdSize => { const s = AD_SLOTS.find((x) => x.id === id)!; return { w: s.w, h: s.h, mw: s.mw, mh: s.mh }; };

/** A to-scale outline of an ad space (wide banners are drawn at most 8:1 so they stay visible). */
function Outline({ w, h, label, max }: { w: number; h: number; label: string; max: number }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mx-auto rounded-md border border-dashed border-brand-500/60 bg-brand-500/5" style={{ aspectRatio: String(Math.min(w / h, 8)), maxWidth: `${Math.min(100, (w / max) * 100)}%` }} aria-hidden />
      <p className="mt-1 text-center text-[11px] text-zinc-500">{label} · {w} × {h}</p>
    </div>
  );
}

/**
 * The ad spaces: what is showing in each, and their sizes. Sizes can be changed separately for
 * computers/tablets and for phones; the site keeps each space in exactly that shape.
 */
function SpaceMap({ ads }: { ads: AdUnit[] }) {
  const { settings, refresh } = useSettings();
  const { toast } = useToast();
  const saved = (): Sizes => { const c = parseAdSizes(settings.adSizes); return Object.fromEntries(AD_SLOTS.map((s) => [s.id, c[s.id] || defaultsOf(s.id)])); };
  const [sizes, setSizes] = useState<Sizes>(saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSizes(saved()), [settings.adSizes]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(sizes) !== JSON.stringify(saved());
  const { minW, maxW, minH, maxH } = AD_SIZE_LIMITS;
  const set = (id: string, k: keyof AdSize, v: string) => setSizes((x) => ({ ...x, [id]: { ...x[id], [k]: Number(v) || 0 } }));
  const valid = Object.values(sizes).every((z) => z.w >= minW && z.w <= maxW && z.mw >= minW && z.mw <= maxW && z.h >= minH && z.h <= maxH && z.mh >= minH && z.mh <= maxH);
  const save = async () => {
    setBusy(true);
    try {
      await api.put('/admin/settings', { adSizes: JSON.stringify(sizes) });
      await refresh();
      toast('Ad sizes saved');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const num = (id: string, k: keyof AdSize, label: string, lo: number, hi: number) => (
    <Input type="number" inputMode="numeric" min={lo} max={hi} value={sizes[id][k] || ''} onChange={(e) => set(id, k, e.target.value)} aria-label={label} className="h-11 min-w-0 flex-1 px-2 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
  );
  return (
    <section aria-label="Ad spaces" data-testid="ad-spaces">
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {AD_SLOTS.map((s) => {
          const live = ads.filter((a) => a.slot === s.id && running(a));
          const z = sizes[s.id];
          const isDefault = JSON.stringify(z) === JSON.stringify(defaultsOf(s.id));
          return (
            <div key={s.id} className="rounded-xl border border-zinc-900 bg-zinc-950 p-4" data-testid={`space-${s.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.label}</p>
                  <p className="text-xs text-zinc-500">{s.where}</p>
                </div>
                {!isDefault && <button type="button" className="shrink-0 text-xs text-zinc-400 underline hover:text-zinc-200" onClick={() => setSizes((x) => ({ ...x, [s.id]: defaultsOf(s.id) }))}>Reset size</button>}
              </div>
              <div className="mt-3 flex items-end gap-3">
                <Outline w={z.w || 1} h={z.h || 1} label="Computer" max={Math.max(z.w, z.mw * 2, 1)} />
                <Outline w={z.mw || 1} h={z.mh || 1} label="Phone" max={Math.max(z.w, z.mw * 2, 1)} />
              </div>
              <div className="mt-3 grid gap-3 min-[420px]:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-zinc-300">Computer &amp; tablet</p>
                  <div className="flex items-center gap-1">{num(s.id, 'w', `${s.label} width on computers`, minW, maxW)}<span className="text-zinc-500">×</span>{num(s.id, 'h', `${s.label} height on computers`, minH, maxH)}</div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-zinc-300">Phone</p>
                  <div className="flex items-center gap-1">{num(s.id, 'mw', `${s.label} width on phones`, minW, maxW)}<span className="text-zinc-500">×</span>{num(s.id, 'mh', `${s.label} height on phones`, minH, maxH)}</div>
                </div>
              </div>
              <p className="mt-3 text-sm">
                {live.length ? (
                  <span className="text-emerald-300">Showing: {live.map((a) => a.name).join(', ')}</span>
                ) : (
                  <span className="text-zinc-400">Empty — {settings.adsEnabled && settings.adsShowPlaceholders ? 'visitors see “' + (settings.adsPlaceholderText || 'Advertise here') + '”' : 'hidden'}</span>
                )}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={busy} disabled={!dirty || !valid} data-testid="save-ad-sizes">Save sizes</Button>
        <p className="text-xs text-zinc-500">
          {valid ? 'Sizes are in pixels. Images in an ad are cropped to fit; use “Which part of the banner shows” on the ad to choose the part.' : `Width ${minW}–${maxW}, height ${minH}–${maxH} pixels.`}
        </p>
      </div>
    </section>
  );
}

export function AdsAdmin() {
  usePageTitle('Admin · Ads');
  const { settings } = useSettings();
  const [ads, setAds] = useState<AdUnit[]>([]);
  const slotLabel = (id: string) => {
    const s = AD_SLOTS.find((x) => x.id === id);
    return s ? `${s.label} (${adSlotSize(s.id, settings.adSizes, false).label})` : `${id} — not used any more`;
  };
  return (
    <>
      <ResourceAdmin<AdUnit>
        title="Ads"
        description="Fixed ad spaces on the site. Several ads in one space take turns (by weight). Empty spaces can show “Advertise here” — see Site settings → Ads."
        endpoint="ads"
        noun="ad"
        onLoaded={setAds}
        defaults={{ name: '', slot: 'home_top', type: 'image', enabled: true, weight: 10 }}
        searchText={(a) => `${a.name} ${a.slot}`}
        toolbar={null}
        fields={(draft) => {
          const slotOk = AD_SLOTS.some((s) => s.id === draft.slot);
          const size = slotOk ? adSlotSize(draft.slot, settings.adSizes, false).label : undefined;
          return [
            { key: 'name', label: 'Name', type: 'text', required: true, hint: 'Shown under in-feed ads, and used as the image description.' },
            { key: 'slot', label: 'Ad space', type: 'select', half: true, options: AD_SLOTS.map((s) => ({ value: s.id, label: `${s.label} — ${adSlotSize(s.id, settings.adSizes, false).label}` })) },
            {
              key: 'type', label: 'Ad type', type: 'select', half: true,
              options: [{ value: 'image', label: 'Image banner' }, { value: 'html', label: 'HTML snippet' }, { value: 'adsense', label: 'Google AdSense' }],
            },
            ...(draft.type === 'html'
              ? [{ key: 'htmlSnippet', label: 'HTML snippet', type: 'textarea', rows: 6, hint: 'Runs in a sandboxed frame inside the space.' }]
              : draft.type === 'adsense'
                ? [{ key: 'adsenseSlotId', label: 'AdSense slot ID', type: 'text', hint: 'Set the client ID under Site settings → Ads.' }]
                : [
                    { key: 'imageUrl', label: 'Banner image', type: 'image', hint: size ? `Best size: ${size} pixels. Other sizes are cropped to fit.` : undefined },
                    { key: 'imageFocus', label: 'Which part of the banner shows', type: 'focus', source: 'imageUrl', ratio: slotOk ? adSlotSize(draft.slot, settings.adSizes, false).ratio : 16 / 9, hint: 'Drag to choose the part that matters, then zoom if you want it closer.' },
                    { key: 'targetUrl', label: 'Click-through link', type: 'url', placeholder: 'https://…' },
                  ]),
            { key: 'startsAt', label: 'Start date (optional)', type: 'date', half: true },
            { key: 'endsAt', label: 'End date (optional)', type: 'date', half: true },
            { key: 'weight', label: 'Weight', type: 'number', half: true, hint: 'Higher = shown more often when ads share a space.' },
            { key: 'enabled', label: 'Enabled', type: 'toggle', defaultOn: true },
          ] as any;
        }}
        columns={[
          { label: 'Ad', render: (a) => <span className="font-medium">{a.name}</span> },
          { label: 'Space', render: (a) => <span className="text-zinc-400">{slotLabel(a.slot)}</span> },
          { label: 'Status', render: (a) => <Badge on={running(a)} yes={schedule(a)} no={schedule(a)} /> },
          {
            label: 'Results',
            render: (a) => (
              <span className="text-xs text-zinc-400">
                {(a.impressions || 0).toLocaleString()} shown · {(a.clicks || 0).toLocaleString()} clicks
                {a.impressions ? ` · ${(((a.clicks || 0) / a.impressions) * 100).toFixed(1)}%` : ''}
              </span>
            ),
          },
        ]}
      />
      <h2 className="mb-3 mt-10 text-lg font-semibold">Ad spaces</h2>
      <SpaceMap ads={ads} />
    </>
  );
}
