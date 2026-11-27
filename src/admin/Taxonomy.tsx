import { useState } from 'react';
import { AD_SLOTS, type AdUnit, type Category } from '../../shared/types';
import { usePageTitle, useSettings } from '../lib/settings';
import { Badge } from '../components/ui';
import ResourceAdmin from './ResourceAdmin';

export function CategoriesAdmin() {
  usePageTitle('Admin · Categories');
  return (
    <ResourceAdmin<Category>
      title="Categories"
      description="The category chips on the home page. A video belongs to one category; matching tags also count."
      endpoint="categories"
      noun="category"
      defaults={{ name: '', order: 10, active: true, tags: [] }}
      sort={(a, b) => (a.order ?? 0) - (b.order ?? 0)}
      searchText={(c) => `${c.name} ${c.slug}`}
      fields={[
        { key: 'name', label: 'Name', type: 'text', required: true, half: true },
        { key: 'order', label: 'Display order', type: 'number', half: true, hint: 'Lower numbers show first.' },
        { key: 'tags', label: 'Matching tags', type: 'tags', hint: 'Videos with any of these tags also appear in this category.' },
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

/** The four ad spaces and what is in each right now. */
function SpaceMap({ ads }: { ads: AdUnit[] }) {
  const { settings } = useSettings();
  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-2" aria-label="Ad spaces" data-testid="ad-spaces">
      {AD_SLOTS.map((s) => {
        const live = ads.filter((a) => a.slot === s.id && running(a));
        return (
          <div key={s.id} className="rounded-xl border border-zinc-900 bg-zinc-950 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{s.label}</p>
                <p className="text-xs text-zinc-500">{s.where}</p>
              </div>
              <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">{s.size}</span>
            </div>
            <div className="mt-3 w-full rounded-md border border-dashed border-zinc-700" style={{ aspectRatio: String(Math.min(s.ratio, 8)) }} aria-hidden />
            <p className="mt-2 text-sm">
              {live.length ? (
                <span className="text-emerald-300">Showing: {live.map((a) => a.name).join(', ')}</span>
              ) : (
                <span className="text-zinc-400">Empty — {settings.adsEnabled && settings.adsShowPlaceholders ? 'visitors see “' + (settings.adsPlaceholderText || 'Advertise here') + '”' : 'hidden'}</span>
              )}
            </p>
          </div>
        );
      })}
    </section>
  );
}

export function AdsAdmin() {
  usePageTitle('Admin · Ads');
  const [ads, setAds] = useState<AdUnit[]>([]);
  const slotLabel = (id: string) => {
    const s = AD_SLOTS.find((x) => x.id === id);
    return s ? `${s.label} (${s.size})` : `${id} — not used any more`;
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
          const size = AD_SLOTS.find((s) => s.id === draft.slot)?.size;
          return [
            { key: 'name', label: 'Name', type: 'text', required: true, hint: 'Shown under in-feed ads, and used as the image description.' },
            { key: 'slot', label: 'Ad space', type: 'select', half: true, options: AD_SLOTS.map((s) => ({ value: s.id, label: `${s.label} — ${s.size}` })) },
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
                    { key: 'imageFocus', label: 'Which part of the banner shows', type: 'focus', source: 'imageUrl', ratio: AD_SLOTS.find((s) => s.id === draft.slot)?.ratio ?? 16 / 9, hint: 'Drag to choose the part that matters, then zoom if you want it closer.' },
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
