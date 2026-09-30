import React, { useEffect, useState, useRef } from 'react';
import { AdUnit } from '../types';
import { api } from '../services/api';
import { ExternalLink } from 'lucide-react';

interface AdBannerProps {
  slot?: 'feed' | 'sidebar' | 'video-page';
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

let cachedAdsSettings: AdsSettings | null = null;
let inflightSettings: Promise<AdsSettings> | null = null;

async function loadAdsSettings(): Promise<AdsSettings> {
  if (cachedAdsSettings) return cachedAdsSettings;
  if (inflightSettings) return inflightSettings;
  inflightSettings = fetch('/api/publicSettings')
    .then((r) => r.json())
    .then((data) => {
      cachedAdsSettings = {
        adsEnabled: !!data.adsEnabled,
        adsenseClientId: data.adsenseClientId || '',
        adsenseBannerSlot: data.adsenseBannerSlot || '',
        adsenseRectangleSlot: data.adsenseRectangleSlot || '',
      };
      return cachedAdsSettings;
    })
    .catch(() => DEFAULT_ADS)
    .finally(() => {
      inflightSettings = null;
    });
  return inflightSettings;
}

const AdBanner: React.FC<AdBannerProps> = ({ slot, type = 'banner', className = '' }) => {
  const targetSlot: 'feed' | 'sidebar' | 'video-page' = slot || (type === 'rectangle' ? 'sidebar' : 'feed');
  const [hasConsent, setHasConsent] = useState(false);
  const [adsSettings, setAdsSettings] = useState<AdsSettings | null>(null);
  const [customAd, setCustomAd] = useState<AdUnit | null>(null);
  const [loaded, setLoaded] = useState(false);
  const impressionRecorded = useRef(false);

  useEffect(() => {
    loadAdsSettings().then(setAdsSettings);
    
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

    // Fetch custom ads
    api.ads.getAll().then((allAds) => {
      if (Array.isArray(allAds)) {
        const matching = allAds.filter((a) => a.enabled && a.slot === targetSlot);
        if (matching.length > 0) {
          // Select random active ad for the slot
          const chosen = matching[Math.floor(Math.random() * matching.length)];
          setCustomAd(chosen);
        }
      }
      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
    });

    return () => {
      window.removeEventListener('storage', handleConsent);
      window.removeEventListener('elysian_cmp_consent_changed', handleConsent);
    };
  }, [targetSlot]);

  // Record impression for custom ad
  useEffect(() => {
    if (customAd && !impressionRecorded.current) {
      impressionRecorded.current = true;
      api.ads.recordImpression(customAd.id).catch(() => {});
    }
  }, [customAd]);

  // AdSense initialization fallback
  useEffect(() => {
    if (!customAd && hasConsent && adsSettings?.adsEnabled && adsSettings.adsenseClientId) {
      const t = setTimeout(() => {
        try {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } catch {}
      }, 500);
      return () => clearTimeout(t);
    }
  }, [customAd, hasConsent, adsSettings]);

  const handleAdClick = () => {
    if (!customAd) return;
    api.ads.recordClick(customAd.id).catch(() => {});
    if (customAd.targetUrl) {
      window.open(customAd.targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Render Custom Ad if available
  if (customAd) {
    const isSidebar = targetSlot === 'sidebar' || type === 'rectangle';

    return (
      <div 
        onClick={handleAdClick}
        className={`group relative bg-zinc-950 border border-zinc-800/80 hover:border-yellow-500/50 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 shadow-lg ${
          isSidebar ? 'w-full max-w-[320px] mx-auto p-4' : 'w-full max-w-5xl mx-auto p-3 sm:p-4 my-4'
        } ${className}`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] uppercase tracking-widest font-bold text-yellow-500/80 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
            {customAd.type === 'sponsor' ? 'Sponsored Partner' : customAd.type === 'affiliate' ? 'Featured Offer' : 'Advertisement'}
          </span>
          <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-yellow-400 transition-colors" />
        </div>

        {customAd.imageUrl ? (
          <div className="relative w-full overflow-hidden rounded-xl bg-zinc-900">
            <img 
              src={customAd.imageUrl} 
              alt={customAd.name} 
              className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                isSidebar ? 'h-48' : 'h-24 sm:h-32'
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-white truncate drop-shadow-md">{customAd.name}</span>
              <span className="text-[10px] text-yellow-400 font-bold bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm">Visit &rarr;</span>
            </div>
          </div>
        ) : customAd.htmlContent ? (
          <div 
            className="w-full text-zinc-300 text-sm"
            dangerouslySetInnerHTML={{ __html: customAd.htmlContent }} 
          />
        ) : (
          <div className="p-4 text-center">
            <p className="text-white font-bold text-sm">{customAd.name}</p>
            <p className="text-xs text-yellow-500 mt-1 font-medium">Explore Exclusive Sponsor &rarr;</p>
          </div>
        )}
      </div>
    );
  }

  // Fallback to AdSense if enabled, otherwise return null
  if (!adsSettings?.adsEnabled) return null;

  const showRealAdSense = hasConsent && adsSettings.adsEnabled && adsSettings.adsenseClientId;
  const adSlot = targetSlot === 'sidebar' ? adsSettings.adsenseRectangleSlot : adsSettings.adsenseBannerSlot;

  return (
    <div className={`relative bg-zinc-950 border border-zinc-900 flex flex-col items-center justify-center overflow-hidden rounded-xl p-4 transition-all duration-300 ${
      targetSlot === 'sidebar' ? 'w-full aspect-square max-w-[300px] mx-auto' : 'w-full min-h-[90px] max-w-4xl mx-auto my-4'
    } ${className}`}>
      <span className="absolute top-1.5 right-2.5 text-[8px] text-zinc-600 uppercase tracking-widest font-bold">Advertisement</span>
      {showRealAdSense ? (
        <div className="w-full h-full flex items-center justify-center min-h-[90px]">
          <ins className="adsbygoogle w-full block h-full text-center"
               style={{ display: 'block', minHeight: '90px' }}
               data-ad-client={adsSettings.adsenseClientId}
               data-ad-slot={adSlot || ''}
               data-ad-format="auto"
               data-full-width-responsive="true"></ins>
        </div>
      ) : (
        <div className="text-center p-3">
          <p className="text-zinc-500 font-bold tracking-widest text-[11px] uppercase">Google AdSense Placement</p>
          <p className="text-[10px] text-zinc-600 mt-1 max-w-[280px] mx-auto leading-normal">
            {!hasConsent ? 'User consent required for ads.' : 'AdSense Client ID or Slot not configured.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AdBanner;
