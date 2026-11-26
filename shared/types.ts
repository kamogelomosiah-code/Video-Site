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
  avatarUrl?: string;
  bio?: string;
  createdAt?: string;
}

export interface MediaItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  /** Direct playable file (mp4/webm or /api/files/...) */
  sourceUrl?: string;
  /** Link to the video on another site, or an embeddable player URL */
  externalUrl?: string;
  redirectUrl?: string;
  playbackMode?: 'external' | 'local';
  mediaType?: 'video' | 'image';
  category?: string;
  tags?: string[];
  duration?: string;
  views?: number;
  likes?: string[];
  dislikes?: string[];
  isPremium?: boolean;
  price?: number;
  published?: boolean;
  userId?: string;
  creatorName?: string;
  creatorAvatar?: string;
  uploadedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  order: number;
  active: boolean;
  tags?: string[];
}

export interface TalentProduct {
  id: string;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  contactUrl?: string;
}

export interface TalentProfile {
  id: string;
  userId?: string;
  name: string;
  title?: string;
  bio?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  hourlyRate?: number;
  imageUrl?: string;
  verified?: boolean;
  online?: boolean;
  tags?: string[];
  availability?: 'Available Now' | 'This Week' | 'Booked';
  contactUrl?: string;
  products?: TalentProduct[];
}

export interface ScheduledEvent {
  id: string;
  title: string;
  description?: string;
  talentId?: string;
  talentName?: string;
  category?: string;
  eventType?: 'livestream' | 'appearance' | 'premiere' | 'chat_session' | 'vip_party';
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;
  locationOrUrl?: string;
  coverImageUrl?: string;
  price?: number;
  isVipOnly?: boolean;
  isLiveNow?: boolean;
  status?: 'scheduled' | 'live' | 'completed' | 'cancelled';
  attendeesCount?: number;
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

export interface Comment {
  id: string;
  mediaId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string;
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
  tagline: string;
  heroHeadline: string;
  heroSubtext: string;
  featuredMediaId: string | null;
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
  tagline: 'Premium media & verified talent',
  heroHeadline: '',
  heroSubtext: '',
  featuredMediaId: null,
  announcementBanner: '',
  announcementLink: '',
  maintenanceMode: false,
  maintenanceMessage: "We're making some improvements. Please check back soon.",
  ageGateEnabled: true,
  ageGateMessage:
    'This website contains age-restricted material intended for adults only. By entering you confirm you are at least 18 years old (or the age of majority where you live) and that viewing such content is legal for you.',
  allowRegistration: true,
  metaTitle: '',
  metaDescription: 'Discover verified creators and premium exclusive media.',
  footerText: '',
  contactEmail: '',
  privacyPolicy: '',
  termsOfService: '',
  adsEnabled: true,
  adsenseClientId: '',
  adsTxtContent: '',
};

export const AD_SLOTS = [
  { id: 'home_top', label: 'Home – top banner' },
  { id: 'home_mid', label: 'Home – between rows' },
  { id: 'media_sidebar', label: 'Video page – sidebar' },
  { id: 'talent_mid', label: 'Creators page – banner' },
] as const;

export interface AdminStats {
  media: number;
  users: number;
  talent: number;
  events: number;
  comments: number;
  totalViews: number;
  topMedia: Array<{ id: string; title: string; views: number }>;
  recentActivity: ActivityLog[];
}
