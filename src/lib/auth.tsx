import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';
import type { User } from '../../shared/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string, pin?: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; role: string; source?: string }) => Promise<User>;
  logout: () => Promise<void>;
  setSession: (user: User, token: string) => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api
      .get<{ user: User | null }>('/auth/session')
      .then((r) => {
        if (r.user) setUser(r.user);
        else tokenStore.set(null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, []);

  const setSession = useCallback((u: User, token: string) => {
    tokenStore.set(token);
    setUser(u);
  }, []);

  const login = useCallback(async (email: string, password: string, pin?: string) => {
    const r = await api.post<{ user: User; token: string }>('/auth/login', { email, password, pin });
    setSession(r.user, r.token);
    return r.user;
  }, [setSession]);

  const register = useCallback(async (data: { name: string; email: string; password: string; role: string; source?: string }) => {
    const r = await api.post<{ user: User; token: string }>('/auth/register', data);
    setSession(r.user, r.token);
    return r.user;
  }, [setSession]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* sign out locally regardless */
    }
    tokenStore.set(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin: user?.role === 'ADMIN', login, register, logout, setSession, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
