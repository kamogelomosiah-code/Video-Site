import { session } from './session';
import {
  User,
  MediaItem,
  TalentProfile,
  Notification,
  Message,
  ActivityLog
} from '../types';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = session.getToken();
  const headers: Record<string, string> = {};

  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (options?.headers) {
    Object.assign(headers, options.headers);
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });

  const text = await res.text().catch(() => '');
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!res.ok) {
    const error: any = new Error((payload && payload.error) || res.statusText || 'Request failed');
    error.status = res.status;
    error.data = payload;
    throw error;
  }

  return payload as T;
}

export const api = {
  system: {
    init: async (): Promise<void> => Promise.resolve(),
    getActivityLogs: (): Promise<ActivityLog[]> => request<ActivityLog[]>('/api/activityLogs'),
    getStatus: (): Promise<any> => request<any>('/api/system/status'),
  },

  auth: {
    login: async (email: string, password: string, pin?: string): Promise<User> => {
      const res = await request<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, pin }),
      });
      session.save(res.user, res.token);
      return res.user;
    },

    register: async ({ name, email, password, role }: any): Promise<User> => {
      const res = await request<{ user: User; token: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      });
      session.save(res.user, res.token);
      return res.user;
    },

    getSession: async (): Promise<User | null> => {
      if (!session.getToken()) return null;
      try {
        const res = await request<{ user: User | null }>('/api/auth/session');
        if (!res.user) {
          session.clear();
          return null;
        }
        return res.user;
      } catch {
        session.clear();
        return null;
      }
    },

    logout: async (): Promise<void> => {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } catch {
        // Continue clearing session locally regardless
      } finally {
        session.clear();
      }
    },

    updateProfile: async (_id: string, updates: Partial<User>): Promise<User> => {
      const res = await request<{ user: User }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      session.updateUser(res.user);
      return res.user;
    },
  },

  media: {
    scrapeMetadata: (url: string): Promise<{ title: string; description: string; tags: string[]; category: string }> =>
      request('/api/scrape-metadata', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),

    uploadFile: async (file: File): Promise<string> => {
      const fd = new FormData();
      fd.append('file', file);
      const data = await request<{ id: string; url: string }>('/api/upload', {
        method: 'POST',
        body: fd,
      });
      return data.url;
    },

    getAll: (): Promise<MediaItem[]> => request<MediaItem[]>('/api/media'),

    getById: (id: string): Promise<MediaItem> => request<MediaItem>(`/api/media/${id}`),

    create: (item: Partial<MediaItem>): Promise<MediaItem> =>
      request<MediaItem>('/api/media', {
        method: 'POST',
        body: JSON.stringify(item),
      }),

    update: (id: string, updates: Partial<MediaItem>): Promise<MediaItem> =>
      request<MediaItem>(`/api/media/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    delete: (id: string): Promise<{ success: boolean }> =>
      request<{ success: boolean }>(`/api/media/${id}`, {
        method: 'DELETE',
      }),

    getRelated: async (id: string): Promise<MediaItem[]> => {
      const all = await request<MediaItem[]>('/api/media');
      return all.filter((m) => m.id !== id).slice(0, 6);
    },

    importBulk: (items: MediaItem[]) => request<{ success: boolean; count: number }>('/api/media/bulk', { method: 'POST', body: JSON.stringify(items) }),

    rate: (mediaId: string, _userId: string, isLike: boolean): Promise<{ likes: number; dislikes: number }> =>
      request(`/api/media/${mediaId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ like: isLike }),
      }),
  },

  users: {
    getAll: (): Promise<User[]> => request<User[]>('/api/users'),

    getById: (id: string): Promise<User> => request<User>(`/api/users/${id}`),

    create: async (userData: any): Promise<User> => {
      const data = await request<any>('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      return data.user || data;
    },

    update: (id: string, updates: Partial<User>): Promise<User> =>
      request<User>(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    delete: (id: string): Promise<{ success: boolean }> =>
      request<{ success: boolean }>(`/api/users/${id}`, {
        method: 'DELETE',
      }),

    subscribe: async (_userId: string, creatorId: string): Promise<User> => {
      const data = await request<{ user: User }>(`/api/users/${creatorId}/subscribe`, {
        method: 'POST',
      });
      session.updateUser(data.user);
      return data.user;
    },
  },

  talent: {
    getAll: (): Promise<TalentProfile[]> => request<TalentProfile[]>('/api/talentProfiles'),

    create: (profile: Partial<TalentProfile>): Promise<TalentProfile> =>
      request<TalentProfile>('/api/talentProfiles', {
        method: 'POST',
        body: JSON.stringify(profile),
      }),

    update: (id: string, updates: Partial<TalentProfile>): Promise<TalentProfile> =>
      request<TalentProfile>(`/api/talentProfiles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    delete: (id: string): Promise<{ success: boolean }> =>
      request<{ success: boolean }>(`/api/talentProfiles/${id}`, {
        method: 'DELETE',
      }),
  },

  notifications: {
    getAll: (_userId?: string): Promise<Notification[]> =>
      request<Notification[]>('/api/notifications/mine'),

    markRead: (id: string): Promise<Notification> =>
      request<Notification>(`/api/notifications/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ read: true }),
      }),

    markAllRead: async (_userId?: string): Promise<void> => {
      try {
        const notifs = await request<Notification[]>('/api/notifications/mine');
        if (Array.isArray(notifs)) {
          for (const n of notifs.filter((i) => !i.read)) {
            await request(`/api/notifications/${n.id}`, {
              method: 'PUT',
              body: JSON.stringify({ read: true }),
            });
          }
        }
      } catch (err) {
        console.error('Failed to mark all notifications read:', err);
      }
    },
  },

  messages: {
    getConversation: (_userId1: string, userId2: string): Promise<Message[]> =>
      request<Message[]>(`/api/messages/conversation/${userId2}`),

    send: (_senderId: string, receiverId: string, text: string): Promise<Message> =>
      request<Message>('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiverId,
          text,
        }),
      }),
  },

  settings: {
    get: (): Promise<{ _id: string; featuredMediaId: string | null }> =>
      request<{ _id: string; featuredMediaId: string | null }>('/api/siteSettings'),

    update: (settings: any): Promise<{ _id: string; featuredMediaId: string | null }> =>
      request<{ _id: string; featuredMediaId: string | null }>('/api/siteSettings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
  },
};
