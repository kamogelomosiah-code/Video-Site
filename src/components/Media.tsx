import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Eye, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AD_SLOTS, adSlotSize, type AdSlotId, type AdUnit, type PublicVideo } from '../../shared/types';
import { useSettings } from '../lib/settings';
import { api } from '../lib/api';
import { formatViews } from '../lib/utils';
import { hasAdConsent } from './ConsentBar';
import { cx } from './ui';
import { videoPath } from '../../shared/seo';
import { focusStyle } from '../../shared/image';
import type { Focus } from '../../shared/image';

/** A thumbnail. `priority` loads it first (the big picture at the top of a page), everything else waits until it scrolls near. */
export function Thumb({ src, alt, className, focus, priority }: { src?: string; alt: string; className?: string; focus?: Focus | null; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div className={cx('flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900', className)}>
        <Play className="h-10 w-10 text-zinc-600" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...({ fetchpriority: priority ? 'high' : 'auto' } as any)}
      onError={() => setFailed(true)}
      className={cx('object-cover', className)}
      style={focusStyle(focus)}
    />
  );
}

/** A video. Opens its page on this site; from there, one more tap watches it on the original website. */
export function VideoCard({ item, className, style }: { item: PublicVideo; className?: string; style?: CSSProperties }) {
  return (
    <Link style={style} to={videoPath(item)} className={cx('group block rounded-2xl outline-offset-4', className)} data-testid="video-card">
      {/* Material card: lifts on hover, presses in on tap, ripple from the finger */}
      <div className="ripple relative aspect-video overflow-hidden rounded-2xl bg-zinc-900 shadow-md shadow-black/30 transition-[transform,box-shadow] duration-300 ease-emphasized group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-black/50 group-active:scale-[.97]">
        <Thumb src={item.thumbnailUrl} focus={item.thumbFocus} alt={item.title} className="h-full w-full transition-[filter] duration-300 group-hover:brightness-110" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-300 ease-emphasized group-hover:bg-black/25 group-hover:opacity-100">
          <span className="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-brand-500 text-zinc-950 shadow-lg transition-transform duration-300 ease-emphasized group-hover:scale-100">
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
    </Link>
  );
}

/** A row you swipe sideways on phones; a normal grid on larger screens. */
export function VideoRow({ items }: { items: PublicVideo[] }) {
  return (
    <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-6 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-5" data-testid="video-row">
      {items.map((m, i) => (
        <VideoCard key={m.id} item={m} className={cx('w-[44%] shrink-0 snap-start sm:w-auto', i >= 5 ? 'sm:hidden' : i === 4 ? 'sm:hidden xl:block' : i === 3 ? 'sm:hidden lg:block' : '')} />
      ))}
    </div>
  );
}

export function VideoGrid({ items, insert }: { items: PublicVideo[]; insert?: { at: number; node: ReactNode } }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((m, i) => (
        <Fragment key={m.id}>
          {insert && i === insert.at && insert.node}
          {/* cards rise in one after another (only the first dozen wait, so long lists stay quick) */}
          <VideoCard item={m} className="animate-card" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }} />
        </Fragment>
      ))}
    </div>
  );
}

/** Shimmering placeholders in the shape of the grid, while videos load. */
export function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5" aria-busy="true" aria-label="Loading videos" data-testid="grid-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skeleton aspect-video rounded-2xl" />
          <div className="skeleton mt-3 h-3.5 w-11/12 rounded-full" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * An ad space. It always keeps its shape (from AD_SLOTS) so the page never jumps. When no ad is
 * running it shows an "Advertise here" box — if that's switched on in Site settings — so the
 * space is visible to potential advertisers.
 */
/** True on phone-sized screens (under 640px), kept up to date when the window is resized or rotated. */
export function useIsPhone() {
  const q = '(max-width: 639px)';
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setPhone(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return phone;
}

export function AdSlot({ slot, className, variant = 'banner' }: { slot: AdSlotId; className?: string; variant?: 'banner' | 'card' }) {
  const { settings } = useSettings();
  const phone = useIsPhone();
  const info = AD_SLOTS.find((s) => s.id === slot)!;
  // The admin can set their own sizes (Admin → Ads → Ad spaces), separately for phones and larger screens.
  const def = { ...adSlotSize(slot, settings.adSizes, phone), label: info.label };
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

  if (!settings.adsEnabled) return null;
  if (ad === undefined) {
    // Still loading: hold the space (an ad or an "Advertise here" box will fill it), so the page doesn't jump.
    if (!settings.adsShowPlaceholders) return null;
    return (
      <aside className={cx(variant === 'card' ? 'block' : 'mx-auto w-full', className)} style={variant === 'banner' ? { maxWidth: def.width } : undefined} aria-hidden>
        {variant === 'banner' && <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600">Sponsored</p>}
        <div className="w-full rounded-xl" style={{ aspectRatio: String(def.ratio) }} />
        {variant === 'card' && <div className="mt-2.5 h-10" />}
      </aside>
    );
  }
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
        <span className="text-[11px] text-zinc-500">{def.label} · {adSlotSize(slot, settings.adSizes, phone).label}</span>
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
          <img src={ad.imageUrl} alt={ad.name} className="h-full w-full object-cover" style={focusStyle(ad.imageFocus)} />
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
