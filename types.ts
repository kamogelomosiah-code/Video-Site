export enum UserRole {
  CONSUMER = 'CONSUMER',
  CREATOR = 'CREATOR',
  PROFESSIONAL = 'PROFESSIONAL',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  verified: boolean;
  avatarUrl: string;
  email?: string;
  password?: string;
  subscriptions?: string[]; // Array of creator IDs this user is subscribed to
  bio: string;
  wallpaperUrl: string;
  acceptsChat: boolean;
  chatEnabled: boolean;
  hasChosenChatPreference: boolean;
}

export interface Comment {
  id: string;
  mediaId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: string;
  likes: number;
}

export interface MediaItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  sourceUrl: string; // URL for the video/image file
  mediaType: 'video' | 'image';
  duration?: string;
  views: number;
  creatorName: string;
  creatorAvatar: string;
  tags: string[];
  isPremium: boolean;
  uploadedAt: string;
  price?: number;
  redirectUrl?: string;
  playbackMode: 'external' | 'local';
  externalUrl: string;
  uploadedBy: string;
  likes?: string[]; // Array of user IDs
  dislikes?: string[]; // Array of user IDs
}

export interface ActivityLog {
  id: string;
  actionType: 'signup' | 'rating' | 'import' | 'error' | 'upload' | 'login' | 'logout' | 'update' | 'delete' | 'subscribe' | 'settings';
  userId?: string;
  details: string;
  timestamp: string;
}

export interface TalentProfile {
  id: string;
  userId: string; // Links talent profile to a user account
  name: string;
  title: string;
  location: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  imageUrl: string;
  verified: boolean;
  online: boolean;
  chatOnline: boolean; // Talent online toggle
  tags: string[];
  availability: 'Available Now' | 'This Week' | 'Booked';
  products: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    contactUrl: string;
  }>;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  userId: string; // consumer
  talentId: string; // talent user id
  status: 'opened' | 'accepted' | 'declined' | 'closed';
  userMessageCount: number; // counts toward the 4-message limit
  messages: ChatMessage[];
  selectedProductId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string; // Recipient
  type: 'like' | 'comment' | 'system' | 'booking' | 'upload';
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
}

export interface FilterState {
  category: string;
  location: string;
  verifiedOnly: boolean;
  priceRange: [number, number];
}