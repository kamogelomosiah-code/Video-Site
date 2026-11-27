import type { Focus } from './image';
// Data shapes shared by the server and the browser.
// Field names match the existing MongoDB collections so old data keeps working.

export type Role = 'CONSUMER' | 'CREATOR' | 'PROFESSIONAL' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  username?: string;
  email?: string;
  role: Role;
  verified: boolean;
  disabled?: boolean;
  avatarUrl?: string;
  bio?: string;
  createdAt?: string;
}

/** A video as stored. Visitors are sent to `externalUrl` (the original site) when they click it. */
export interface Video {
  id: string;
  title: string;
  externalUrl: string;
  thumbnailUrl?: string;
  /** Which part of the thumbnail shows, and how far it is zoomed. */
  thumbFocus?: Focus;
  description?: string;
  category?: string;
  tags?: string[];
  duration?: string;
  creatorName?: string;
  views?: number;
  likes?: number;
  dislikes?: number;
  published?: boolean;
  /** Pinned to the top of the Trending row. */
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** What the public site is allowed to see (no outgoing link — visitors go through /go/:id). */
export type PublicVideo = Pick<Video, 'id' | 'title' | 'thumbnailUrl' | 'thumbFocus' | 'likes' | 'dislikes' | 'category' | 'tags' | 'duration' | 'views' | 'creatorName' | 'featured' | 'createdAt'>;

/** Everything the video page shows. */
export type VideoDetail = PublicVideo & {
  description: string;
  /** The website the video is on, e.g. "youtube.com". */
  source: string;
  categoryName: string;
};

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  order: number;
  active: boolean;
  tags?: string[];
}

export interface AdUnit {
  id: string;
  name: string;
  slot: string;
  type: 'image' | 'html' | 'adsense';
  enabled: boolean;
  imageUrl?: string;
  /** Which part of the banner shows, and how far it is zoomed. */
  imageFocus?: Focus;
  targetUrl?: string;
  htmlSnippet?: string;
  adsenseSlotId?: string;
  weight?: number;
  impressions?: number;
  clicks?: number;
  /** Optional schedule, YYYY-MM-DD (inclusive). */
  startsAt?: string;
  endsAt?: string;
}

export interface ActivityLog {
  id: string;
  actionType: string;
  userId?: string;
  details: string;
  timestamp: string;
}

/** Everything an admin can change in Site Settings. All of it is used by the public site. */
export interface SiteSettings {
  siteName: string;
  heroHeadline: string;
  heroSubtext: string;
  /** Rotate the pinned / trending videos as big pictures at the top of the home page. */
  heroSlides: boolean;
  /** The small attention-grabbing label on those pictures. */
  heroCallout: string;
  announcementBanner: string;
  announcementLink: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  ageGateEnabled: boolean;
  ageGateMessage: string;
  allowRegistration: boolean;
  metaTitle: string;
  metaDescription: string;
  footerText: string;
  contactEmail: string;
  privacyPolicy: string;
  termsOfService: string;
  adsEnabled: boolean;
  adsenseClientId: string;
  adsTxtContent: string;
  /** Show an "Advertise here" box in ad spaces that have no ad running. */
  adsShowPlaceholders: boolean;
  adsPlaceholderText: string;
  /** Where the "Advertise here" box links (a page, https:// link or mailto:). Falls back to the contact email. */
  adsContactLink: string;
  /** Your own sizes for the ad spaces, as JSON: { "home_top": { "w": 970, "h": 90, "mw": 320, "mh": 100 } }. Blank = the defaults. */
  adSizes: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Elysian',
  heroHeadline: 'Find something to watch',
  heroSubtext: 'Tap a video to see what it is about, then watch it on the original site.',
  heroSlides: true,
  heroCallout: 'Trending now',
  announcementBanner: '',
  announcementLink: '',
  maintenanceMode: false,
  maintenanceMessage: "We're making some improvements. Please check back soon.",
  ageGateEnabled: true,
  ageGateMessage:
    'This website contains age-restricted material intended for adults only. By entering you confirm you are at least 18 years old (or the age of majority where you live) and that viewing such content is legal for you.',
  allowRegistration: true,
  metaTitle: '',
  metaDescription: 'Search and discover videos.',
  footerText: '',
  contactEmail: '',
  privacyPolicy: '',
  termsOfService: '',
  adsEnabled: true,
  adsenseClientId: '',
  adsTxtContent: '',
  adsShowPlaceholders: true,
  adsPlaceholderText: 'Advertise here',
  adsContactLink: '',
  adSizes: '',
};

/**
 * The ad spaces on the site. Each one is a fixed box with a set shape, so the page layout
 * never jumps and advertisers know exactly what size to supply.
 */
export const AD_SLOTS = [
  { id: 'home_top', label: 'Top banner', where: 'Home page, under the search box', size: '970 × 90', width: 970, ratio: 970 / 90, w: 970, h: 90, mw: 320, mh: 100 },
  { id: 'home_infeed', label: 'In-feed card', where: 'Home page, inside the video grid (looks like a video)', size: '1280 × 720', width: 1280, ratio: 16 / 9, w: 1280, h: 720, mw: 1280, mh: 720 },
  { id: 'home_mid', label: 'Mid banner', where: 'Home page and video pages, between rows of videos', size: '970 × 250', width: 970, ratio: 970 / 250, w: 970, h: 250, mw: 300, mh: 250 },
  { id: 'footer', label: 'Footer banner', where: 'Every page, above the footer', size: '728 × 90', width: 728, ratio: 728 / 90, w: 728, h: 90, mw: 320, mh: 100 },
] as const;

export interface AdSize { w: number; h: number; mw: number; mh: number }
export const AD_SIZE_LIMITS = { minW: 100, maxW: 2000, minH: 30, maxH: 1200 };

/** Reads the admin's own sizes (settings.adSizes), keeping only sensible numbers. */
export function parseAdSizes(raw: string | undefined): Partial<Record<AdSlotId, AdSize>> {
  let j: any;
  try { j = raw ? JSON.parse(raw) : {}; } catch { return {}; }
  const out: Partial<Record<AdSlotId, AdSize>> = {};
  const { minW, maxW, minH, maxH } = AD_SIZE_LIMITS;
  const n = (v: unknown, lo: number, hi: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= lo && x <= hi ? x : 0; };
  for (const s of AD_SLOTS) {
    const v = j?.[s.id];
    if (!v || typeof v !== 'object') continue;
    const size = { w: n(v.w, minW, maxW) || s.w, h: n(v.h, minH, maxH) || s.h, mw: n(v.mw, minW, maxW) || s.mw, mh: n(v.mh, minH, maxH) || s.mh };
    if (size.w !== s.w || size.h !== s.h || size.mw !== s.mw || size.mh !== s.mh) out[s.id] = size;
  }
  return out;
}

/** The size of an ad space right now: the admin's choice or the default, for phones or larger screens. */
export function adSlotSize(slot: AdSlotId, adSizes: string | undefined, phone: boolean): { width: number; height: number; ratio: number; label: string } {
  const d = AD_SLOTS.find((s) => s.id === slot)!;
  const c = parseAdSizes(adSizes)[slot] || { w: d.w, h: d.h, mw: d.mw, mh: d.mh };
  const [width, height] = phone ? [c.mw, c.mh] : [c.w, c.h];
  return { width, height, ratio: width / height, label: `${width} × ${height}` };
}

export type AdSlotId = (typeof AD_SLOTS)[number]['id'];

export interface AdminStats {
  videos: number;
  published: number;
  drafts: number;
  users: number;
  categories: number;
  totalViews: number;
  topVideos: Array<{ id: string; title: string; views: number }>;
  recentActivity: ActivityLog[];
  system: {
    storage: 'mongodb' | 'json';
    database: string;
    emailProvider: 'smtp' | 'resend' | 'sendgrid' | 'console';
    adminPin: boolean;
  };
}
