import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { DEFAULT_SETTINGS, type SiteSettings } from '../../shared/types';

interface SettingsState {
  settings: SiteSettings;
  loaded: boolean;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsState>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  refresh: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSettings({ ...DEFAULT_SETTINGS, ...(await api.get<SiteSettings>('/settings')) });
    } catch {
      /* keep defaults */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep the tab title / description in sync with what the admin set.
  useEffect(() => {
    if (!loaded) return;
    document.title = settings.metaTitle || settings.siteName;
    document.querySelector('meta[name="description"]')?.setAttribute('content', settings.metaDescription);
  }, [loaded, settings.metaTitle, settings.siteName, settings.metaDescription]);

  return <SettingsContext.Provider value={{ settings, loaded, refresh }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

/** Set the browser tab title for a page. */
export function usePageTitle(title?: string) {
  const { settings } = useSettings();
  useEffect(() => {
    document.title = title ? `${title} · ${settings.siteName}` : settings.metaTitle || settings.siteName;
  }, [title, settings.siteName, settings.metaTitle]);
}
