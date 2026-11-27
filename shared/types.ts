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
export type PublicVideo = Pick<Video, 'id' | 'title' | 'thumbnailUrl' | 'category' | 'tags' | 'duration' | 'views' | 'creatorName' | 'featured' | 'createdAt'>;

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
  targetUrl?: string;
  htmlSnippet?: string;
  adsenseSlotId?: string;
  weight?: number;
  impressions?: number;
  clicks?: number;
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
};

export const AD_SLOTS = [
  { id: 'home_top', label: 'Home – under the search box' },
  { id: 'home_mid', label: 'Home – inside the video list' },
] as const;

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
