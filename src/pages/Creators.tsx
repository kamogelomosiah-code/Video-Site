import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, ExternalLink, MapPin, Star, Users } from 'lucide-react';
import type { MediaItem, TalentProfile } from '../../shared/types';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { formatPrice, useFetch } from '../lib/utils';
import { AdSlot, MediaGrid, Thumb } from '../components/Media';
import { Empty, Input, Spinner, cx } from '../components/ui';

function Availability({ value }: { value?: string }) {
  if (!value) return null;
  const color = value === 'Available Now' ? 'bg-emerald-500' : value === 'Booked' ? 'bg-zinc-500' : 'bg-brand-500';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
      <span className={cx('h-2 w-2 rounded-full', color)} /> {value}
    </span>
  );
}

export function CreatorsPage() {
  usePageTitle('Creators');
  const { data, loading } = useFetch(() => api.get<TalentProfile[]>('/talent'), []);
  const [q, setQ] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data || []).filter(
      (t) =>
        (!verifiedOnly || t.verified) &&
        (!s || [t.name, t.title, t.location, ...(t.tags || [])].some((v) => String(v || '').toLowerCase().includes(s))),
    );
  }, [data, q, verifiedOnly]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Creators</h1>
          <p className="text-sm text-zinc-400">Browse verified creators and their offerings.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, city, tag…" className="sm:w-64" aria-label="Search creators" />
          <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="accent-amber-500" /> Verified
          </label>
        </div>
      </div>
      <AdSlot slot="talent_mid" className="mb-6" />
      {loading ? (
        <Spinner />
      ) : !list.length ? (
        <Empty title={data?.length ? 'No creators match your filters' : 'No creators yet'} icon={<Users className="h-10 w-10" />} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {list.map((t) => (
            <Link key={t.id} to={`/creators/${t.id}`} className="group overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/40 hover:border-zinc-700" data-testid="creator-card">
              <div className="relative aspect-[4/5] overflow-hidden">
                <Thumb src={t.imageUrl} alt={t.name} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
                {t.online && <span className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-zinc-950">ONLINE</span>}
              </div>
              <div className="space-y-1 p-3">
                <p className="flex items-center gap-1 font-semibold">
                  <span className="min-w-0 truncate">{t.name}</span>
                  {t.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-400" aria-label="Verified" />}
                </p>
                {t.title && <p className="truncate text-xs text-zinc-400">{t.title}</p>}
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  {t.location ? <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="min-w-0 truncate">{t.location}</span></span> : <span />}
                  {!!t.rating && <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-brand-400 text-brand-400" />{t.rating.toFixed(1)}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function CreatorDetailPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useFetch(() => api.get<{ profile: TalentProfile; media: MediaItem[] }>(`/talent/${id}`), [id]);
  usePageTitle(data?.profile.name);
  if (loading) return <Spinner />;
  if (error || !data) return <Empty title="Creator not found"><Link to="/creators" className="text-brand-400">Back to creators</Link></Empty>;
  const t = data.profile;
  return (
    <div className="space-y-10">
      <section className="grid gap-6 md:grid-cols-[280px_1fr]">
        <Thumb src={t.imageUrl} alt={t.name} className="aspect-[4/5] w-full rounded-2xl" />
        <div className="space-y-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              {t.name} {t.verified && <BadgeCheck className="h-6 w-6 text-brand-400" aria-label="Verified" />}
            </h1>
            {t.title && <p className="mt-1 text-zinc-400">{t.title}</p>}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
            {t.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{t.location}</span>}
            {!!t.rating && <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-brand-400 text-brand-400" />{t.rating.toFixed(2)} ({t.reviewCount || 0} reviews)</span>}
            {!!t.hourlyRate && <span>From {formatPrice(t.hourlyRate)}/hr</span>}
            <Availability value={t.availability} />
          </div>
          {t.bio && <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{t.bio}</p>}
          {!!t.tags?.length && (
            <div className="flex flex-wrap gap-2">{t.tags.map((tag) => <span key={tag} className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">#{tag}</span>)}</div>
          )}
          {t.contactUrl && (
            <a href={t.contactUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-brand-400">
              Contact / Book <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </section>

      {!!t.products?.length && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Offerings</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.products.map((p) => (
              <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/40">
                {p.imageUrl && <Thumb src={p.imageUrl} alt="" className="aspect-video w-full" />}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{p.name}</h3>
                    <span className="shrink-0 font-semibold text-brand-400">{formatPrice(p.price)}</span>
                  </div>
                  {p.description && <p className="mt-1 flex-1 text-sm text-zinc-400">{p.description}</p>}
                  {p.contactUrl && (
                    <a href={p.contactUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-400 hover:underline">
                      Get this <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!data.media.length && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Videos</h2>
          <MediaGrid items={data.media} />
        </section>
      )}
    </div>
  );
}
