import { Link } from 'react-router-dom';
import { BadgeCheck, ExternalLink, Star } from 'lucide-react';
import type { AdUnit, Category, MediaItem, ScheduledEvent, TalentProfile } from '../../shared/types';
import { AD_SLOTS } from '../../shared/types';
import { api } from '../lib/api';
import { useSettings, usePageTitle } from '../lib/settings';
import { formatDate, formatViews, useFetch } from '../lib/utils';
import { Thumb } from '../components/Media';
import { Button, Select, cx, useToast } from '../components/ui';
import ResourceAdmin, { type FieldDef } from './ResourceAdmin';
import { ExportVideosButton, ImportVideosButton } from './MediaJson';

const Badge = ({ on, yes, no }: { on: boolean; yes: string; no: string }) => (
  <span className={cx('rounded-full px-2 py-0.5 text-xs', on ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-400')}>{on ? yes : no}</span>
);
const newest = (a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));

// --- Videos ---

export function MediaAdmin() {
  usePageTitle('Admin · Videos');
  const { settings, refresh } = useSettings();
  const { toast, confirm } = useToast();
  const { data: categories } = useFetch(() => api.get<Category[]>('/admin/categories'), []);
  const catOptions = [{ value: '', label: '— None —' }, ...(categories || []).map((c) => ({ value: c.slug, label: c.name }))];

  const fields: FieldDef[] = [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    {
      key: 'externalUrl', label: 'Video link', type: 'url', placeholder: 'https://…',
      hint: 'YouTube/Vimeo links and embed URLs play on the page; any other link opens the video on its own site.',
    },
    { key: 'sourceUrl', label: 'Direct video file (optional)', type: 'url', placeholder: 'https://…/video.mp4', hint: 'An .mp4 / .webm file URL plays in the built-in player.' },
    { key: 'thumbnailUrl', label: 'Thumbnail', type: 'image' },
    { key: 'category', label: 'Category', type: 'select', options: catOptions, half: true },
    { key: 'duration', label: 'Duration', type: 'text', placeholder: '12:34', half: true },
    { key: 'tags', label: 'Tags', type: 'tags' },
    { key: 'creatorName', label: 'Creator name', type: 'text', half: true },
    { key: 'price', label: 'Price (R)', type: 'number', half: true },
    { key: 'isPremium', label: 'Premium', type: 'toggle', hint: 'Shows a Premium badge.' },
    { key: 'published', label: 'Published', type: 'toggle', defaultOn: true, hint: 'Turn off to hide this video from visitors (draft).' },
  ];

  const bulk = async (ids: string[], action: string, done: () => void, category?: string) => {
    if (action === 'delete' && !(await confirm(`Delete ${ids.length} video(s)? This can't be undone.`, { confirmLabel: 'Delete' }))) return;
    try {
      const r = await api.post<{ count: number }>('/admin/media/bulk', { ids, action, category });
      toast(`${r.count} video(s) updated`);
      if (action === 'delete') await refresh();
      done();
    } catch (x: any) {
      toast(x.message, 'error');
    }
  };

  const feature = async (m: MediaItem) => {
    const on = settings.featuredMediaId === m.id;
    try {
      await api.put('/admin/settings', { featuredMediaId: on ? null : m.id });
      await refresh();
      toast(on ? 'Removed from homepage spotlight' : `“${m.title}” is now featured on the homepage`);
    } catch (x: any) {
      toast(x.message, 'error');
    }
  };

  return (
    <ResourceAdmin<MediaItem>
      title="Videos"
      description="Add, edit, publish and feature videos. Import many at once from JSON."
      endpoint="media"
      toolbar={(reload) => (
        <>
          <ImportVideosButton onDone={reload} />
          <ExportVideosButton />
        </>
      )}
      bulkBar={(ids, done) => (
        <>
          <Button variant="secondary" onClick={() => bulk(ids, 'publish', done)}>Publish</Button>
          <Button variant="secondary" onClick={() => bulk(ids, 'unpublish', done)}>Unpublish</Button>
          <Select
            aria-label="Move selected to category"
            className="w-auto"
            value=""
            onChange={(e) => e.target.value && bulk(ids, 'category', done, e.target.value === '__none' ? '' : e.target.value)}
          >
            <option value="">Move to category…</option>
            {(categories || []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            <option value="__none">— No category —</option>
          </Select>
          <Button variant="danger" onClick={() => bulk(ids, 'delete', done)}>Delete</Button>
        </>
      )}
      noun="video"
      defaults={{ title: '', published: true, isPremium: false, tags: [], mediaType: 'video' }}
      fields={fields}
      sort={newest}
      searchText={(m) => [m.title, m.category, m.creatorName, ...(m.tags || [])].join(' ')}
      columns={[
        {
          label: 'Video',
          render: (m) => (
            <div className="flex items-center gap-3">
              <Thumb src={m.thumbnailUrl} alt="" className="h-12 w-20 shrink-0 rounded-md" />
              <div className="min-w-0">
                <p className="line-clamp-1 font-medium">{m.title}</p>
                <p className="text-xs text-zinc-500">{m.creatorName}</p>
              </div>
            </div>
          ),
        },
        { label: 'Category', render: (m) => <span className="text-zinc-400">{categories?.find((c) => c.slug === m.category)?.name || m.category || '—'}</span> },
        { label: 'Views', render: (m) => formatViews(m.views) },
        {
          label: 'Status',
          render: (m) => (
            <div className="flex flex-wrap gap-1">
              <Badge on={m.published !== false} yes="Published" no="Draft" />
              {settings.featuredMediaId === m.id && <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs text-brand-300">Featured</span>}
            </div>
          ),
        },
      ]}
      rowActions={(m) => (
        <>
          <Button variant="ghost" className="px-2.5" onClick={() => feature(m)} aria-label={settings.featuredMediaId === m.id ? 'Unfeature' : 'Feature on homepage'} title="Feature on homepage">
            <Star className={cx('h-4 w-4', settings.featuredMediaId === m.id && 'fill-brand-400 text-brand-400')} />
          </Button>
          <Link to={`/watch/${m.id}`} target="_blank" className="rounded-lg p-2.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Open video" title="Open on site">
            <ExternalLink className="h-4 w-4" />
          </Link>
        </>
      )}
    />
  );
}

// --- Categories ---

export function CategoriesAdmin() {
  usePageTitle('Admin · Categories');
  return (
    <ResourceAdmin<Category>
      title="Categories"
      description="The filter chips on the homepage. Videos match by their category or by any of the category's tags."
      endpoint="categories"
      noun="category"
      defaults={{ name: '', slug: '', order: 10, active: true, tags: [] }}
      sort={(a, b) => (a.order ?? 0) - (b.order ?? 0)}
      searchText={(c) => `${c.name} ${c.slug}`}
      fields={[
        { key: 'name', label: 'Name', type: 'text', required: true, half: true },
        { key: 'slug', label: 'URL name', type: 'text', hint: 'Leave blank to generate from the name.', half: true },
        { key: 'order', label: 'Display order', type: 'number', hint: 'Lower numbers show first.', half: true },
        { key: 'tags', label: 'Matching tags', type: 'tags', hint: 'Videos tagged with any of these appear in this category.' },
        { key: 'description', label: 'Description', type: 'textarea', rows: 2 },
        { key: 'active', label: 'Show on homepage', type: 'toggle', defaultOn: true },
      ]}
      columns={[
        { label: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
        { label: 'URL name', render: (c) => <code className="text-xs text-zinc-400">{c.slug}</code> },
        { label: 'Order', render: (c) => c.order },
        { label: 'Visible', render: (c) => <Badge on={c.active !== false} yes="Shown" no="Hidden" /> },
      ]}
    />
  );
}

// --- Creators ---

export function TalentAdmin() {
  usePageTitle('Admin · Creators');
  return (
    <ResourceAdmin<TalentProfile>
      title="Creators"
      description="Profiles shown in the Creators directory."
      endpoint="talent"
      noun="creator"
      defaults={{ name: '', verified: false, online: false, tags: [], products: [], rating: 5, reviewCount: 0, availability: 'Available Now' }}
      sort={(a, b) => a.name.localeCompare(b.name)}
      searchText={(t) => [t.name, t.title, t.location, ...(t.tags || [])].join(' ')}
      fields={[
        { key: 'name', label: 'Name', type: 'text', required: true, half: true },
        { key: 'title', label: 'Headline', type: 'text', placeholder: 'e.g. Glamour model', half: true },
        { key: 'imageUrl', label: 'Profile photo', type: 'image' },
        { key: 'bio', label: 'Bio', type: 'textarea' },
        { key: 'location', label: 'Location', type: 'text', half: true },
        {
          key: 'availability', label: 'Availability', type: 'select', half: true,
          options: ['Available Now', 'This Week', 'Booked'].map((v) => ({ value: v, label: v })),
        },
        { key: 'hourlyRate', label: 'Rate from (R/hour)', type: 'number', half: true },
        { key: 'contactUrl', label: 'Contact / booking link', type: 'url', placeholder: 'https://…', half: true },
        { key: 'rating', label: 'Rating (0–5)', type: 'number', half: true },
        { key: 'reviewCount', label: 'Review count', type: 'number', half: true },
        { key: 'userId', label: 'Linked user ID (optional)', type: 'text', hint: "Shows this user's uploaded videos on the profile." },
        { key: 'tags', label: 'Tags', type: 'tags' },
        { key: 'verified', label: 'Verified', type: 'toggle', hint: 'Shows the verified badge.' },
        { key: 'online', label: 'Online now', type: 'toggle' },
        { key: 'hidden', label: 'Hide from directory', type: 'toggle' },
        { key: 'products', label: 'Offerings', type: 'products' },
      ]}
      columns={[
        {
          label: 'Creator',
          render: (t) => (
            <div className="flex items-center gap-3">
              <Thumb src={t.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 font-medium">{t.name}{t.verified && <BadgeCheck className="h-4 w-4 text-brand-400" />}</p>
                <p className="truncate text-xs text-zinc-500">{t.title}</p>
              </div>
            </div>
          ),
        },
        { label: 'Location', render: (t) => <span className="text-zinc-400">{t.location || '—'}</span> },
        { label: 'Offerings', render: (t) => t.products?.length || 0 },
        { label: 'Status', render: (t) => <Badge on={!(t as any).hidden} yes="Listed" no="Hidden" /> },
      ]}
    />
  );
}

// --- Events ---

export function EventsAdmin() {
  usePageTitle('Admin · Events');
  return (
    <ResourceAdmin<ScheduledEvent>
      title="Events"
      description="Live streams, premieres and appearances on the Events page."
      endpoint="events"
      noun="event"
      defaults={{ title: '', date: new Date().toISOString().slice(0, 10), startTime: '20:00', eventType: 'livestream', status: 'scheduled', tags: [] }}
      sort={(a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)}
      searchText={(e) => `${e.title} ${e.talentName || ''} ${e.category || ''}`}
      fields={[
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'description', label: 'Description', type: 'textarea', rows: 3 },
        { key: 'date', label: 'Date', type: 'date', required: true, half: true },
        {
          key: 'eventType', label: 'Type', type: 'select', half: true,
          options: [
            { value: 'livestream', label: 'Live stream' }, { value: 'premiere', label: 'Premiere' },
            { value: 'appearance', label: 'Appearance' }, { value: 'chat_session', label: 'Chat session' }, { value: 'vip_party', label: 'VIP party' },
          ],
        },
        { key: 'startTime', label: 'Starts', type: 'time', half: true },
        { key: 'endTime', label: 'Ends', type: 'time', half: true },
        { key: 'talentName', label: 'Featuring', type: 'text', half: true },
        { key: 'price', label: 'Price (R, 0 = free)', type: 'number', half: true },
        { key: 'locationOrUrl', label: 'Location or join link', type: 'text', placeholder: 'https://… or a venue' },
        { key: 'coverImageUrl', label: 'Cover image', type: 'image' },
        {
          key: 'status', label: 'Status', type: 'select', half: true,
          options: [{ value: 'scheduled', label: 'Scheduled' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled (hidden)' }],
        },
        { key: 'isLiveNow', label: 'Live right now', type: 'toggle', hint: 'Pins the event to the top with a LIVE badge.' },
        { key: 'isVipOnly', label: 'VIP only', type: 'toggle' },
      ]}
      columns={[
        { label: 'Event', render: (e) => <span className="font-medium">{e.title}</span> },
        { label: 'When', render: (e) => <span className="text-zinc-400">{formatDate(e.date, e.startTime)}</span> },
        { label: 'Featuring', render: (e) => <span className="text-zinc-400">{e.talentName || '—'}</span> },
        {
          label: 'Status',
          render: (e) =>
            e.isLiveNow ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold">LIVE</span> : <span className="text-xs capitalize text-zinc-400">{e.status}</span>,
        },
      ]}
    />
  );
}

// --- Ads ---

export function AdsAdmin() {
  usePageTitle('Admin · Ads');
  const slotLabel = (s: string) => AD_SLOTS.find((x) => x.id === s)?.label || s;
  return (
    <ResourceAdmin<AdUnit>
      title="Ads"
      description="Banner and sponsor placements. When several ads share a placement, they rotate by weight."
      endpoint="ads"
      noun="ad"
      defaults={{ name: '', slot: 'home_top', type: 'image', enabled: true, weight: 10 }}
      searchText={(a) => `${a.name} ${a.slot}`}
      fields={(draft) => [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'slot', label: 'Placement', type: 'select', half: true, options: AD_SLOTS.map((s) => ({ value: s.id, label: s.label })) },
        {
          key: 'type', label: 'Ad type', type: 'select', half: true,
          options: [{ value: 'image', label: 'Image banner' }, { value: 'html', label: 'HTML / script snippet' }, { value: 'adsense', label: 'Google AdSense' }],
        },
        ...(draft.type === 'image'
          ? ([
              { key: 'imageUrl', label: 'Banner image', type: 'image' },
              { key: 'targetUrl', label: 'Click-through link', type: 'url', placeholder: 'https://…' },
            ] as FieldDef[])
          : draft.type === 'html'
            ? ([{ key: 'htmlSnippet', label: 'HTML snippet', type: 'textarea', rows: 6, hint: 'Runs in a sandboxed frame.' }] as FieldDef[])
            : ([{ key: 'adsenseSlotId', label: 'AdSense slot ID', type: 'text', hint: 'Set your AdSense client ID under Site settings → Ads.' }] as FieldDef[])),
        { key: 'weight', label: 'Weight', type: 'number', half: true, hint: 'Higher = shown more often.' },
        { key: 'enabled', label: 'Enabled', type: 'toggle' },
      ]}
      columns={[
        { label: 'Ad', render: (a) => <span className="font-medium">{a.name}</span> },
        { label: 'Placement', render: (a) => <span className="text-zinc-400">{slotLabel(a.slot)}</span> },
        { label: 'Status', render: (a) => <Badge on={a.enabled} yes="Running" no="Paused" /> },
        {
          label: 'Performance',
          render: (a) => (
            <span className="text-xs text-zinc-400">
              {a.impressions || 0} views · {a.clicks || 0} clicks
              {!!a.impressions && ` · ${(((a.clicks || 0) / a.impressions) * 100).toFixed(1)}% CTR`}
            </span>
          ),
        },
      ]}
    />
  );
}
