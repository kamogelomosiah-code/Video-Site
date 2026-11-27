// Small helpers shared by the server (pages search engines read) and the browser (links people click).
import { slugify } from './video';

/** The address of a video's page, with its title in it: /v/abc123/funny-cat-video */
export function videoPath(v: { id: string; title?: string }): string {
  const slug = slugify(v.title || '').slice(0, 80).replace(/-+$/, '');
  return `/v/${encodeURIComponent(v.id)}${slug ? `/${slug}` : ''}`;
}
export const categoryPath = (slug: string) => `/c/${encodeURIComponent(slug)}`;
export const tagPath = (tag: string) => `/tag/${encodeURIComponent(tag.toLowerCase())}`;

/** "12:30" or "1:02:03" -> "PT12M30S" (the format search engines expect for durations). */
export function isoDuration(d?: string): string | undefined {
  const parts = String(d || '').trim().split(':').map((x) => Number(x));
  if (parts.length < 2 || parts.length > 3 || parts.some((x) => !Number.isFinite(x) || x < 0)) return undefined;
  const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
  const total = h * 3600 + m * 60 + s;
  if (!total) return undefined;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s ? `${s}S` : ''}`;
}

/** A player address for well-known sites (lets search engines treat the page as a video page). */
export function embedUrlFor(link: string): string | undefined {
  let u: URL;
  try { u = new URL(link); } catch { return undefined; }
  const host = u.hostname.replace(/^(www|m)\./, '');
  const id = (re: RegExp, s: string) => re.exec(s)?.[1];
  if (host === 'youtube.com') {
    const v = u.searchParams.get('v') || id(/^\/(?:shorts|embed|live)\/([\w-]{6,})/, u.pathname);
    return v ? `https://www.youtube.com/embed/${v}` : undefined;
  }
  if (host === 'youtu.be') { const v = id(/^\/([\w-]{6,})/, u.pathname); return v ? `https://www.youtube.com/embed/${v}` : undefined; }
  if (host === 'vimeo.com') { const v = id(/^\/(\d+)/, u.pathname); return v ? `https://player.vimeo.com/video/${v}` : undefined; }
  if (host === 'dailymotion.com') { const v = id(/^\/video\/([a-z0-9]+)/i, u.pathname); return v ? `https://www.dailymotion.com/embed/video/${v}` : undefined; }
  return undefined;
}

/** A short plain-text summary for a meta description (about 155 characters, cut at a word). */
export function summary(text: string, max = 155): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[\s,.;:–-]+$/, '') + '…';
}
