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
  description?: string;
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
  name: string;
  title: string;
  location: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  imageUrl: string;
  verified: boolean;
  online: boolean;
  tags: string[];
  availability: 'Available Now' | 'This Week' | 'Booked';
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