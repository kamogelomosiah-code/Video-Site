import React, { useEffect, useState } from 'react';

interface AdBannerProps {
  type?: 'banner' | 'rectangle';
  className?: string;
}

const AdBanner: React.FC<AdBannerProps> = ({ type = 'banner', className = '' }) => {
  const [hasConsent, setHasConsent] = useState<boolean>(false);

  // Check consent state on mount and on storage updates
  useEffect(() => {
    const checkConsent = () => {
      try {
        const consent = localStorage.getItem('elysian_cmp_consent');
        const isGranted = consent === 'granted' || consent === 'all';
        setHasConsent(isGranted);

        if (isGranted && (window as any).__loadAdSense) {
          (window as any).__loadAdSense();
        }
      } catch (e) {
        console.error(e);
      }
    };

    // Initial check
    checkConsent();

    // Listen for custom events and standard storage event to update instantly
    const handleConsentChange = () => {
      checkConsent();
    };

    window.addEventListener('storage', handleConsentChange);
    window.addEventListener('elysian_cmp_consent_changed', handleConsentChange);

    return () => {
      window.removeEventListener('storage', handleConsentChange);
      window.removeEventListener('elysian_cmp_consent_changed', handleConsentChange);
    };
  }, []);

  // Initialize the ad push once consent is verified and script is initialized
  useEffect(() => {
    if (hasConsent) {
      const timer = setTimeout(() => {
        try {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } catch (e) {
          console.warn("[Elysian CMP] AdSense pushed or pending layout insertion:", e);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasConsent]);

  return (
    <div className={`relative bg-zinc-950 border border-zinc-900 flex flex-col items-center justify-center overflow-hidden rounded-xl p-4 transition-all duration-300 ${
        type === 'rectangle' ? 'w-full aspect-square max-w-[300px] mx-auto' : 'w-full min-h-[90px] max-w-4xl mx-auto'
    } ${className}`}>
      <span className="absolute top-1.5 right-2.5 text-[8px] text-zinc-600 uppercase tracking-widest font-bold">Advertisement</span>
      
      {hasConsent ? (
        <div className="w-full h-full flex items-center justify-center min-h-[90px]">
          {/* Real Google AdSense Unit - ca-pub-6421372298185696 */}
          <ins className="adsbygoogle w-full block h-full text-center"
               style={{ display: 'block', minHeight: '90px' }}
               data-ad-client="ca-pub-6421372298185696"
               data-ad-slot={type === 'rectangle' ? "7381290481" : "9018374821"}
               data-ad-format="auto"
               data-full-width-responsive="true"></ins>
        </div>
      ) : (
        <div className="text-center p-3">
          <p className="text-zinc-500 font-bold tracking-widest text-[11px] uppercase">GOOGLE ADSENSE BLOCK</p>
          <p className="text-[10px] text-zinc-600 mt-1 max-w-[280px] mx-auto leading-normal">
            To display this ad unit, please consent to the GDPR/ePrivacy cookie policy in the consent banner.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdBanner;
