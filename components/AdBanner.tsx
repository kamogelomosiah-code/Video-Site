import React, { useEffect, useState } from 'react';

interface AdBannerProps {
  type?: 'banner' | 'rectangle';
  className?: string;
}

interface AdsSettings {
  adsEnabled: boolean;
  adsenseClientId: string;
  adsenseBannerSlot: string;
  adsenseRectangleSlot: string;
}

const DEFAULT_ADS: AdsSettings = {
  adsEnabled: false,
  adsenseClientId: '',
  adsenseBannerSlot: '',
  adsenseRectangleSlot: '',
};

let cachedAds: AdsSettings | null = null;
let inflight: Promise<AdsSettings> | null = null;

async function loadAdsSettings(): Promise<AdsSettings> {
  if (cachedAds) return cachedAds;
  if (inflight) return inflight;
  inflight = fetch('/api/publicSettings')
    .then((r) => r.json())
    .then((data) => {
      cachedAds = {
        adsEnabled: !!data.adsEnabled,
        adsenseClientId: data.adsenseClientId || '',
        adsenseBannerSlot: data.adsenseBannerSlot || '',
        adsenseRectangleSlot: data.adsenseRectangleSlot || '',
      };
      return cachedAds;
    })
    .catch(() => DEFAULT_ADS)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

const AdBanner: React.FC<AdBannerProps> = ({ type = 'banner', className = '' }) => {
  const [hasConsent, setHasConsent] = useState(false);
  const [ads, setAds] = useState<AdsSettings | null>(null);

  useEffect(() => {
    loadAdsSettings().then(setAds);
    const checkConsent = () => {
      try {
        const consent = localStorage.getItem('elysian_cmp_consent');
        setHasConsent(consent === 'granted' || consent === 'all');
      } catch {
        setHasConsent(false);
      }
    };
    checkConsent();
    const handleConsent = () => checkConsent();
    window.addEventListener('storage', handleConsent);
    window.addEventListener('elysian_cmp_consent_changed', handleConsent);
    return () => {
      window.removeEventListener('storage', handleConsent);
      window.removeEventListener('elysian_cmp_consent_changed', handleConsent);
    };
  }, []);

  useEffect(() => {
    if (hasConsent && ads?.adsEnabled && ads.adsenseClientId) {
      const t = setTimeout(() => {
        try {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } catch {}
      }, 500);
      return () => clearTimeout(t);
    }
  }, [hasConsent, ads]);

  if (!ads?.adsEnabled) return null;

  const showRealAd = hasConsent && ads?.adsEnabled && ads.adsenseClientId;
  const slot = type === 'rectangle' ? ads?.adsenseRectangleSlot : ads?.adsenseBannerSlot;

  return (
    <div className={`relative bg-zinc-950 border border-zinc-900 flex flex-col items-center justify-center overflow-hidden rounded-xl p-4 transition-all duration-300 ${
      type === 'rectangle' ? 'w-full aspect-square max-w-[300px] mx-auto' : 'w-full min-h-[90px] max-w-4xl mx-auto'
    } ${className}`}>
      <span className="absolute top-1.5 right-2.5 text-[8px] text-zinc-600 uppercase tracking-widest font-bold">Advertisement</span>
      {showRealAd ? (
        <div className="w-full h-full flex items-center justify-center min-h-[90px]">
          <ins className="adsbygoogle w-full block h-full text-center"
               style={{ display: 'block', minHeight: '90px' }}
               data-ad-client={ads.adsenseClientId}
               data-ad-slot={slot || ''}
               data-ad-format="auto"
               data-full-width-responsive="true"></ins>
        </div>
      ) : (
        <div className="text-center p-3">
          <p className="text-zinc-500 font-bold tracking-widest text-[11px] uppercase">GOOGLE ADSENSE BLOCK</p>
          <p className="text-[10px] text-zinc-600 mt-1 max-w-[280px] mx-auto leading-normal">
            {!hasConsent ? 'Consent required for personalized ads.' : 'AdSense Client ID or Slot not configured.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AdBanner;
