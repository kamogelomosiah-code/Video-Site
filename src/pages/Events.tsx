import { CalendarDays, Crown, ExternalLink, Radio } from 'lucide-react';
import type { ScheduledEvent } from '../../shared/types';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { formatDate, formatPrice, useFetch } from '../lib/utils';
import { Thumb } from '../components/Media';
import { Empty, Spinner } from '../components/ui';

export default function EventsPage() {
  usePageTitle('Events');
  const { data, loading } = useFetch(() => api.get<ScheduledEvent[]>('/events'), []);
  return (
    <div>
      <h1 className="text-2xl font-bold">Events</h1>
      <p className="mb-6 text-sm text-zinc-400">Live streams, premieres and appearances.</p>
      {loading ? (
        <Spinner />
      ) : !data?.length ? (
        <Empty title="No upcoming events" icon={<CalendarDays className="h-10 w-10" />}>New events are announced regularly.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((e) => (
            <article key={e.id} className="flex overflow-hidden rounded-xl border border-zinc-900 bg-zinc-900/40" data-testid="event-card">
              <Thumb src={e.coverImageUrl} alt="" className="w-32 shrink-0 sm:w-44" />
              <div className="min-w-0 flex-1 space-y-1.5 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {e.isLiveNow ? (
                    <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 font-bold"><Radio className="h-3 w-3" /> LIVE NOW</span>
                  ) : (
                    <span className="text-brand-400">{formatDate(e.date, e.startTime)}</span>
                  )}
                  {e.isVipOnly && <span className="inline-flex items-center gap-1 text-brand-300"><Crown className="h-3 w-3" /> VIP</span>}
                </div>
                <h2 className="font-semibold leading-snug">{e.title}</h2>
                {e.talentName && <p className="text-sm text-zinc-400">with {e.talentName}</p>}
                {e.description && <p className="line-clamp-2 text-sm text-zinc-500">{e.description}</p>}
                <div className="flex items-center justify-between pt-1 text-sm">
                  <span className="text-zinc-300">{formatPrice(e.price)}</span>
                  {e.locationOrUrl && !/^https?:\/\//i.test(e.locationOrUrl) && (
                    <span className="min-w-0 truncate text-zinc-400">{e.locationOrUrl}</span>
                  )}
                  {e.locationOrUrl && /^https?:\/\//i.test(e.locationOrUrl) && (
                    <a href={e.locationOrUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-400 hover:underline">
                      {e.isLiveNow ? 'Join' : 'Details'} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
