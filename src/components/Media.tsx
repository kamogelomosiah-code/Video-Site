import { useEffect, useRef, useState } from 'react';
import { Eye, Play } from 'lucide-react';
import type { AdUnit, PublicVideo } from '../../shared/types';
import { api } from '../lib/api';
import { formatViews } from '../lib/utils';
import { hasAdConsent } from './ConsentBar';
import { cx } from './ui';

export function Thumb({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div className={cx('flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900', className)}>
        <Play className="h-10 w-10 text-zinc-600" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cx('object-cover', className)} />;
}

/**
 * A video. It's a normal link to /go/:id, which counts the click and sends the visitor to the
 * original website — so it opens in a new tab and works even before the page's JavaScript loads.
 */
export function VideoCard({ item, className }: { item: PublicVideo; className?: string }) {
  return (
    <a
      href={`/go/${item.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cx('group block', className)}
      data-testid="video-card"
      aria-label={`${item.title} — opens on the original site`}
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-900">
        <Thumb src={item.thumbnailUrl} alt="" className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-zinc-950">
            <Play className="h-6 w-6 fill-current" />
          </span>
        </span>
        {item.duration && <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium">{item.duration}</span>}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug group-hover:text-brand-300">{item.title}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
        {item.creatorName && <span className="min-w-0 truncate">{item.creatorName} ·</span>}
        <Eye className="h-3 w-3 shrink-0" /> {formatViews(item.views)}
      </p>
    </a>
  );
}

export function VideoGrid({ items }: { items: PublicVideo[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((m) => <VideoCard key={m.id} item={m} />)}
    </div>
  );
}

/** Renders the ad an admin assigned to `slot` (or nothing). */
export function AdSlot({ slot, className }: { slot: string; className?: string }) {
  const [ad, setAd] = useState<(AdUnit & { adsenseClientId?: string }) | null>(null);
  const insRef = useRef<HTMLModElement>(null);
  useEffect(() => {
    let alive = true;
    api.get<AdUnit | null>(`/ads/${slot}`).then((a) => alive && setAd(a)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [slot]);
  useEffect(() => {
    if (ad?.type === 'adsense' && insRef.current && hasAdConsent()) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch {
        /* blocked */
      }
    }
  }, [ad]);
  if (!ad) return null;

  const click = () => api.post(`/ads/${ad.id}/click`).catch(() => {});
  return (
    <aside className={cx('overflow-hidden rounded-xl', className)} aria-label="Advertisement" data-testid={`ad-${slot}`}>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">Sponsored</p>
      {ad.type === 'image' && ad.imageUrl && (
        <a href={ad.targetUrl || '#'} target="_blank" rel="noopener noreferrer sponsored" onClick={click}>
          <img src={ad.imageUrl} alt={ad.name} className="w-full rounded-xl object-cover" />
        </a>
      )}
      {ad.type === 'html' && ad.htmlSnippet && (
        // Sandboxed so third-party ad code can't touch the site or the visitor's session.
        <iframe
          title={ad.name}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          srcDoc={`<!doctype html><body style="margin:0;background:transparent">${ad.htmlSnippet}</body>`}
          className="h-32 w-full border-0"
        />
      )}
      {ad.type === 'adsense' && ad.adsenseClientId && ad.adsenseSlotId && hasAdConsent() && (
        <ins
          ref={insRef}
          className="adsbygoogle block"
          data-ad-client={ad.adsenseClientId}
          data-ad-slot={ad.adsenseSlotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </aside>
  );
}
