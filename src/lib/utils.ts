import { useEffect, useState, useCallback } from 'react';

export function formatViews(n = 0): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function timeAgo(iso?: string): string {
  const t = Date.parse(iso || '');
  if (!t) return '';
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  const units: [number, string][] = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
  for (const [secs, name] of units) {
    const v = Math.floor(s / secs);
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export function formatDate(date: string, time?: string): string {
  const d = new Date(`${date}T${time || '00:00'}`);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export const formatPrice = (n?: number) => (n ? `R${Number(n).toLocaleString()}` : 'Free');

/** Small data-fetching hook with loading / error / reload. */
export function useFetch<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await run());
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

/** Build a player for a video: direct file, embeddable page, or link-out. */
export function playbackFor(m: { sourceUrl?: string; externalUrl?: string; redirectUrl?: string }):
  | { kind: 'file'; url: string }
  | { kind: 'embed'; url: string }
  | { kind: 'link'; url: string }
  | { kind: 'none' } {
  const src = m.sourceUrl || '';
  if (src && (src.startsWith('/api/files/') || /\.(mp4|webm|m4v|mov|ogg)(\?|$)/i.test(src))) return { kind: 'file', url: src };
  const ext = m.externalUrl || m.redirectUrl || (src.startsWith('http') ? src : '');
  if (!ext) return { kind: 'none' };
  const yt = ext.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vimeo = ext.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: 'embed', url: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\/embed(ed)?[/?]|player\./i.test(ext)) return { kind: 'embed', url: ext };
  if (/\.(mp4|webm|m4v|mov)(\?|$)/i.test(ext)) return { kind: 'file', url: ext };
  return { kind: 'link', url: ext };
}
