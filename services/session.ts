import { User } from '../types';

const TOKEN_KEY = 'elysian_token';
const USER_KEY = 'elysian_user';

export const session = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  getUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  save(user: User, token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('[session] Failed to save session to localStorage:', e);
    }
  },

  updateUser(user: User): void {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('[session] Failed to update user in localStorage:', e);
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.error('[session] Failed to clear session from localStorage:', e);
    }
  }
};
