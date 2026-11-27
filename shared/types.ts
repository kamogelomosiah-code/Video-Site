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
  published?: boolean;
  /** Pinned to the top of the Trending row. */
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** What the public site is allowed to see (no outgoing link — visitors go through /go/:id). */
export type PublicVideo = Pick<Video, 'id' | 'title' | 'thumbnailUrl' | 'thumbFocus' | 'category' | 'tags' | 'duration' | 'views' | 'creatorName' | 'featured' | 'createdAt'>;

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
}

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Elysian',
  heroHeadline: 'Find something to watch',
  heroSubtext: 'Search the collection, then tap a video to watch it on the original site.',
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
};

/**
 * The ad spaces on the site. Each one is a fixed box with a set shape, so the page layout
 * never jumps and advertisers know exactly what size to supply.
 */
export const AD_SLOTS = [
  { id: 'home_top', label: 'Top banner', where: 'Home page, under the search box', size: '970 × 90', width: 970, ratio: 970 / 90 },
  { id: 'home_infeed', label: 'In-feed card', where: 'Home page, inside the video grid (looks like a video)', size: '1280 × 720', width: 1280, ratio: 16 / 9 },
  { id: 'home_mid', label: 'Mid banner', where: 'Home page, between rows of videos', size: '970 × 250', width: 970, ratio: 970 / 250 },
  { id: 'footer', label: 'Footer banner', where: 'Every page, above the footer', size: '728 × 90', width: 728, ratio: 728 / 90 },
] as const;

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
