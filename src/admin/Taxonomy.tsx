import { AD_SLOTS, type AdUnit, type Category } from '../../shared/types';
import { usePageTitle } from '../lib/settings';
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

export function AdsAdmin() {
  usePageTitle('Admin · Ads');
  const slotLabel = (s: string) => AD_SLOTS.find((x) => x.id === s)?.label || s;
  return (
    <ResourceAdmin<AdUnit>
      title="Ads"
      description="Banners shown on the home page. When several ads share a place, they rotate by weight."
      endpoint="ads"
      noun="ad"
      defaults={{ name: '', slot: 'home_top', type: 'image', enabled: true, weight: 10 }}
      searchText={(a) => `${a.name} ${a.slot}`}
      fields={(draft) => [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'slot', label: 'Where it shows', type: 'select', half: true, options: AD_SLOTS.map((s) => ({ value: s.id, label: s.label })) },
        {
          key: 'type', label: 'Ad type', type: 'select', half: true,
          options: [{ value: 'image', label: 'Image banner' }, { value: 'html', label: 'HTML snippet' }, { value: 'adsense', label: 'Google AdSense' }],
        },
        ...(draft.type === 'html'
          ? ([{ key: 'htmlSnippet', label: 'HTML snippet', type: 'textarea', rows: 6, hint: 'Runs in a sandboxed frame.' }] as const)
          : draft.type === 'adsense'
            ? ([{ key: 'adsenseSlotId', label: 'AdSense slot ID', type: 'text', hint: 'Set the client ID under Site settings → Ads.' }] as const)
            : ([
                { key: 'imageUrl', label: 'Banner image', type: 'image' },
                { key: 'targetUrl', label: 'Click-through link', type: 'url', placeholder: 'https://…' },
              ] as const)),
        { key: 'weight', label: 'Weight', type: 'number', half: true, hint: 'Higher = shown more often.' },
        { key: 'enabled', label: 'Enabled', type: 'toggle', defaultOn: true },
      ] as any}
      columns={[
        { label: 'Ad', render: (a) => <span className="font-medium">{a.name}</span> },
        { label: 'Where', render: (a) => <span className="text-zinc-400">{slotLabel(a.slot)}</span> },
        { label: 'Status', render: (a) => <Badge on={a.enabled} yes="Running" no="Paused" /> },
        {
          label: 'Results',
          render: (a) => (
            <span className="text-xs text-zinc-400">
              {a.impressions || 0} shown · {a.clicks || 0} clicks
            </span>
          ),
        },
      ]}
    />
  );
}
