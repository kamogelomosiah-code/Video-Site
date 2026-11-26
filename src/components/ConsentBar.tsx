import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../lib/settings';
import { Button } from './ui';

const KEY = 'elysian_cmp_consent';

function readConsent(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Load Google AdSense only after the visitor agrees to advertising cookies. */
export function loadAdSense(clientId: string) {
  if (!clientId || (window as any).__adsenseLoaded) return;
  (window as any).__adsenseLoaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
  document.head.appendChild(s);
}

export const hasAdConsent = () => {
  const c = readConsent();
  return c === 'granted' || c === 'all';
};

export default function ConsentBar() {
  const { settings, loaded } = useSettings();
  const [choice, setChoice] = useState(readConsent);
  const needsConsent = loaded && settings.adsEnabled && !!settings.adsenseClientId;

  useEffect(() => {
    if (needsConsent && hasAdConsent()) loadAdSense(settings.adsenseClientId);
  }, [needsConsent, settings.adsenseClientId, choice]);

  if (!needsConsent || choice) return null;
  const save = (v: 'granted' | 'denied') => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
    setChoice(v);
  };
  return (
    <div className="fixed inset-x-0 bottom-0 z-[150] border-t border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-zinc-400">
          We use cookies for advertising and to understand how the site is used. See our{' '}
          <Link to="/privacy" className="text-brand-400 underline">privacy policy</Link>.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => save('denied')}>Decline</Button>
          <Button onClick={() => save('granted')}>Accept</Button>
        </div>
      </div>
    </div>
  );
}
