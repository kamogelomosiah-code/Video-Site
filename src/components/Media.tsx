import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, Play } from 'lucide-react';
import { AD_SLOTS, type AdSlotId, type AdUnit, type PublicVideo } from '../../shared/types';
import { useSettings } from '../lib/settings';
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

export function VideoGrid({ items, insert }: { items: PublicVideo[]; insert?: { at: number; node: ReactNode } }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((m, i) => (
        <Fragment key={m.id}>
          {insert && i === insert.at && insert.node}
          <VideoCard item={m} />
        </Fragment>
      ))}
    </div>
  );
}

/**
 * An ad space. It always keeps its shape (from AD_SLOTS) so the page never jumps. When no ad is
 * running it shows an "Advertise here" box — if that's switched on in Site settings — so the
 * space is visible to potential advertisers.
 */
export function AdSlot({ slot, className, variant = 'banner' }: { slot: AdSlotId; className?: string; variant?: 'banner' | 'card' }) {
  const { settings } = useSettings();
  const def = AD_SLOTS.find((s) => s.id === slot)!;
  const [ad, setAd] = useState<(AdUnit & { adsenseClientId?: string }) | null | undefined>(undefined);
  const insRef = useRef<HTMLModElement>(null);
  useEffect(() => {
    let alive = true;
    api.get<AdUnit | null>(`/ads/${slot}`).then((a) => alive && setAd(a)).catch(() => alive && setAd(null));
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

  if (!settings.adsEnabled || ad === undefined) return null;
  if (!ad && !settings.adsShowPlaceholders) return null;

  // Where "Advertise here" leads: the admin's own link if set, otherwise the site's enquiry page.
  const contact = settings.adsContactLink || '/advertise';
  const box = (inner: ReactNode) => (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: String(def.ratio) }}>
      {inner}
    </div>
  );

  let body: ReactNode;
  if (!ad) {
    const text = (
      <span className="flex h-full min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-3 text-center text-zinc-400 transition-colors hover:border-brand-500 hover:text-brand-300">
        <span className="text-sm font-semibold">{settings.adsPlaceholderText || 'Advertise here'}</span>
        <span className="text-[11px] text-zinc-500">{def.label} · {def.size}</span>
      </span>
    );
    body = (
      <div className="relative w-full" style={{ aspectRatio: String(def.ratio) }} data-testid={`ad-placeholder-${slot}`}>
        <div className="absolute inset-0">
          {contact ? (
            <a href={contact} target={contact.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="block h-full">{text}</a>
          ) : (
            text
          )}
        </div>
      </div>
    );
  } else {
    const click = () => api.post(`/ads/${ad.id}/click`).catch(() => {});
    if (ad.type === 'image' && ad.imageUrl) {
      body = box(
        <a href={ad.targetUrl || '#'} target="_blank" rel="noopener noreferrer sponsored" onClick={click} className="block h-full">
          <img src={ad.imageUrl} alt={ad.name} className="h-full w-full object-cover" />
        </a>,
      );
    } else if (ad.type === 'html' && ad.htmlSnippet) {
      // Sandboxed so third-party ad code can't touch the site or the visitor's session.
      body = box(
        <iframe
          title={ad.name}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          srcDoc={`<!doctype html><body style="margin:0;background:transparent;color:#e4e4e7;font-family:system-ui,sans-serif">${ad.htmlSnippet}</body>`}
          className="absolute inset-0 h-full w-full border-0"
        />,
      );
    } else if (ad.type === 'adsense' && ad.adsenseClientId && ad.adsenseSlotId && hasAdConsent()) {
      body = (
        <ins
          ref={insRef}
          className="adsbygoogle block"
          data-ad-client={ad.adsenseClientId}
          data-ad-slot={ad.adsenseSlotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      );
    } else {
      return null;
    }
  }

  return (
    <aside
      className={cx(variant === 'card' ? 'block' : 'mx-auto w-full', className)}
      // Banners never grow past their real size, so they look the way the advertiser designed them.
      style={variant === 'banner' ? { maxWidth: def.width } : undefined}
      aria-label="Advertisement"
      data-testid={`ad-${slot}`}
    >
      {variant === 'banner' && <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">Sponsored</p>}
      {body}
      {variant === 'card' && (
        <p className="mt-2.5 text-sm font-semibold leading-snug text-zinc-300">
          {ad ? ad.name : settings.adsPlaceholderText || 'Advertise here'}
          <span className="mt-1 block text-xs font-normal uppercase tracking-wider text-zinc-600">Sponsored</span>
        </p>
      )}
    </aside>
  );
}
