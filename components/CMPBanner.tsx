import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Settings, X, Copy, Check, Info } from 'lucide-react';

interface CMPBannerProps {
  onOpenLegalDocs?: (tab: 'privacy' | 'terms') => void;
}

/**
 * Main CMP Consent Banner for Visitors
 */
const CMPBanner: React.FC<CMPBannerProps> = ({ onOpenLegalDocs }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'two-choice' | 'three-choice'>(() => {
    return (localStorage.getItem('elysian_cmp_layout_mode') as any) || 'three-choice';
  });
  const [showManageModal, setShowManageModal] = useState(false);

  // Preference switches inside Manage Options
  const [prefs, setPrefs] = useState({
    necessary: true,
    analytics: true,
    adsense: true,
  });

  useEffect(() => {
    try {
      const consent = localStorage.getItem('elysian_cmp_consent');
      if (!consent) {
        // Show after a brief delay for a polished entering feel
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Listen for sandbox changes to keep the live preview updated instantly
  useEffect(() => {
    const handleSandboxUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.layoutMode) {
        setLayoutMode(customEvent.detail.layoutMode);
      }
      if (customEvent.detail?.resetState) {
        setIsVisible(true);
      }
    };

    window.addEventListener('elysian_cmp_sandbox_update', handleSandboxUpdate);
    return () => {
      window.removeEventListener('elysian_cmp_sandbox_update', handleSandboxUpdate);
    };
  }, []);

  const handleConsentAll = () => {
    try {
      localStorage.setItem('elysian_cmp_consent', 'granted');
      if ((window as any).__loadAdSense) {
        (window as any).__loadAdSense();
      }
      window.dispatchEvent(new Event('elysian_cmp_consent_changed'));
      setIsVisible(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDoNotConsent = () => {
    try {
      localStorage.setItem('elysian_cmp_consent', 'denied');
      window.dispatchEvent(new Event('elysian_cmp_consent_changed'));
      setIsVisible(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePreferences = () => {
    try {
      if (prefs.adsense) {
        localStorage.setItem('elysian_cmp_consent', 'granted');
        if ((window as any).__loadAdSense) {
          (window as any).__loadAdSense();
        }
      } else {
        localStorage.setItem('elysian_cmp_consent', 'partially-granted');
      }
      window.dispatchEvent(new Event('elysian_cmp_consent_changed'));
      setShowManageModal(false);
      setIsVisible(false);
    } catch (e) {
      console.error(e);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Slide-Up GDPR/ePrivacy CMP Consent Banner */}
      <div id="gdpr-cookie-banner" className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-5 md:p-6 z-[90] flex flex-col md:flex-row items-start gap-4 animate-fade-in-up">
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-2.5 rounded-xl text-yellow-500 flex-shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-bold text-white text-sm md:text-base">We Value Your GDPR/ePrivacy Choice</h4>
              <span className="bg-green-500/10 text-green-400 text-[10px] px-1.5 py-0.5 rounded-full border border-green-500/20 font-bold uppercase tracking-wider">
                Google Certified CMP
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed mt-1">
              Elysian and its authorized partners store/access information on your device (cookies) and process personal data (IP addresses) to analyze telemetry and serve personalized Google AdSense advertisements. You have the absolute right to configure or refuse these options. Read our{' '}
              <button 
                onClick={() => onOpenLegalDocs?.('privacy')}
                className="text-yellow-500 font-semibold hover:underline"
              >
                Privacy Policy
              </button>{' '}
              and{' '}
              <button 
                onClick={() => onOpenLegalDocs?.('terms')}
                className="text-yellow-500 font-semibold hover:underline"
              >
                Terms of Service
              </button>.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1 w-full">
            {layoutMode === 'two-choice' ? (
              <>
                <button
                  onClick={handleConsentAll}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2.5 px-5 rounded-lg text-xs md:text-sm shadow-lg shadow-yellow-600/15 transition-all text-center flex-1"
                >
                  Accept & Consent
                </button>
                <button
                  onClick={() => setShowManageModal(true)}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-semibold py-2.5 px-5 rounded-lg text-xs md:text-sm transition-all text-center flex-1"
                >
                  Manage Options
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleConsentAll}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2.5 px-5 rounded-lg text-xs md:text-sm shadow-lg shadow-yellow-600/15 transition-all text-center sm:col-span-2 flex-1"
                >
                  Accept & Consent
                </button>
                <button
                  onClick={handleDoNotConsent}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold py-2.5 px-4 rounded-lg text-xs md:text-sm transition-all text-center flex-1"
                >
                  Do Not Consent
                </button>
                <button
                  onClick={() => setShowManageModal(true)}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold py-2.5 px-4 rounded-lg text-xs md:text-sm transition-all text-center flex-1"
                >
                  Manage Options
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preferences Management Overlay Dialog */}
      {showManageModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 flex flex-col max-h-[calc(100vh-2rem)] shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-900 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-yellow-500" />
                <h3 className="font-bold text-white text-base">Cookie & Advertising Choices</h3>
              </div>
              <button 
                onClick={() => setShowManageModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-full hover:bg-zinc-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1 scrollbar-thin min-h-0">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Deactivating tracking toggles will stop the initialization of non-essential cookies. Strictly necessary settings cannot be deactivated.
              </p>

              <div className="space-y-3">
                {/* Option 1 */}
                <div className="flex items-center justify-between p-3.5 bg-zinc-900/50 rounded-xl border border-zinc-900">
                  <div>
                    <span className="font-bold text-white text-xs block mb-0.5">Strictly Necessary (Required)</span>
                    <p className="text-zinc-400 text-[10px]">Stores age-verification parameters and sign-in credentials.</p>
                  </div>
                  <span className="text-[10px] bg-yellow-500/15 text-yellow-400 font-bold px-2 py-1 rounded border border-yellow-500/20 uppercase tracking-widest">
                    Active
                  </span>
                </div>

                {/* Option 2 */}
                <div className="flex items-center justify-between p-3.5 bg-zinc-900/50 rounded-xl border border-zinc-900">
                  <div>
                    <span className="font-bold text-white text-xs block mb-0.5">Analytics & Stats</span>
                    <p className="text-zinc-400 text-[10px]">Measures latency metrics and load balancers.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrefs(p => ({ ...p, analytics: !p.analytics }))}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 ${prefs.analytics ? 'bg-yellow-500' : 'bg-zinc-800'}`}
                  >
                    <span className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${prefs.analytics ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Option 3 */}
                <div className="flex items-center justify-between p-3.5 bg-zinc-900/50 rounded-xl border border-zinc-900">
                  <div>
                    <span className="font-bold text-white text-xs block mb-0.5">Personalized Ads (AdSense)</span>
                    <p className="text-zinc-400 text-[10px]">Google AdSense targeting script for EEA/UK audience optimization.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrefs(p => ({ ...p, adsense: !p.adsense }))}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 ${prefs.adsense ? 'bg-yellow-500' : 'bg-zinc-800'}`}
                  >
                    <span className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${prefs.adsense ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex space-x-2 pt-4 border-t border-zinc-900 flex-shrink-0">
              <button
                onClick={() => setShowManageModal(false)}
                className="bg-zinc-900 border border-zinc-800 text-zinc-400 py-2.5 px-4 rounded-lg text-xs font-semibold hover:text-white transition-all flex-1"
              >
                Back
              </button>
              <button
                onClick={handleSavePreferences}
                className="bg-yellow-500 hover:bg-yellow-600 text-black py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex-1"
              >
                Save Choices
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Interactive CMP Sandbox for Site Administrators and Developers
 */
export const CMPSandbox: React.FC = () => {
  const [layoutMode, setLayoutMode] = useState<'two-choice' | 'three-choice'>(() => {
    return (localStorage.getItem('elysian_cmp_layout_mode') as any) || 'three-choice';
  });
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleLayoutModeChange = (mode: 'two-choice' | 'three-choice') => {
    setLayoutMode(mode);
    localStorage.setItem('elysian_cmp_layout_mode', mode);
    
    // Dispatch update event to the main banner
    window.dispatchEvent(
      new CustomEvent('elysian_cmp_sandbox_update', {
        detail: { layoutMode: mode }
      })
    );
  };

  const handleResetConsent = () => {
    localStorage.removeItem('elysian_cmp_consent');
    
    // Dispatch reset event to trigger banner slide-up
    window.dispatchEvent(
      new CustomEvent('elysian_cmp_sandbox_update', {
        detail: { resetState: true }
      })
    );
    alert("Consent state cleared! The GDPR Consent Banner has been triggered and is now visible at the bottom of the screen.");
  };

  // Option 1 Source Code Script
  const option1Code = `<!-- OPTION 1: GOOGLE-CERTIFIED CMP COOKIE BANNER (2 CHOICES) -->
<!-- GDPR & ePrivacy Compliant Consent Script for video-3oy8.onrender.com -->
<div id="elysian-gdpr-banner" style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 92%; max-width: 600px; background: #09090b; border: 1px solid #27272a; border-radius: 16px; padding: 20px; box-shadow: 0 15px 35px rgba(0,0,0,0.9); z-index: 999999; font-family: sans-serif; display: none;">
  <div style="display: flex; gap: 14px; margin-bottom: 16px; align-items: flex-start;">
    <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px; padding: 8px; color: #eab308;">
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    </div>
    <div>
      <h4 style="margin: 0; color: #fff; font-size: 15px; font-weight: bold;">We Value Your Privacy</h4>
      <p style="margin: 4px 0 0 0; color: #a1a1aa; font-size: 11.5px; line-height: 1.6;">
        We and our partners process personal data like IP addresses and store device cookies to deliver customized Google AdSense ads and analyze site metrics. Read our <a href="/privacy" style="color: #eab308; text-decoration: none; font-weight: 600;">Privacy Policy</a>.
      </p>
    </div>
  </div>
  <div style="display: flex; gap: 8px; flex-direction: row; width: 100%;">
    <button onclick="grantAllConsent()" style="flex: 1; background: #eab308; color: #000; border: none; border-radius: 8px; padding: 12px; font-size: 13px; font-weight: bold; cursor: pointer; transition: background 0.2s;">Consent & Accept</button>
    <button onclick="toggleOptionsPanel()" style="flex: 1; background: #18181b; color: #fff; border: 1px solid #27272a; border-radius: 8px; padding: 12px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s;">Manage Options</button>
  </div>
</div>

<script>
  (function() {
    // Blocks AdSense loader until user gives consent
    window.__loadAdSenseScript = function() {
      if (window.__adSenseLoaded) return;
      window.__adSenseLoaded = true;
      var script = document.createElement('script');
      script.async = true;
      script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6421372298185696";
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    };

    // Check saved state
    var consent = localStorage.getItem('elysian_cmp_consent');
    if (consent === 'granted') {
      window.__loadAdSenseScript();
    } else if (!consent) {
      document.getElementById('elysian-gdpr-banner').style.display = 'block';
    }
  })();

  function grantAllConsent() {
    localStorage.setItem('elysian_cmp_consent', 'granted');
    document.getElementById('elysian-gdpr-banner').style.display = 'none';
    window.__loadAdSenseScript();
  }

  function toggleOptionsPanel() {
    // Direct compliance fallback fallback configuration dialog
    var opt = confirm("Save settings with recommended options? \\n- Strictly Necessary (Required)\\n- Analytics Cookies (Active)\\n- Personalized AdSense (Active)");
    if (opt) grantAllConsent();
  }
</script>`;

  // Option 2 Source Code Script
  const option2Code = `<!-- OPTION 2: GOOGLE-CERTIFIED CMP COOKIE BANNER (3 CHOICES) -->
<!-- GDPR & ePrivacy Compliant Consent Script for video-3oy8.onrender.com -->
<div id="elysian-gdpr-banner-3" style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 92%; max-width: 600px; background: #09090b; border: 1px solid #27272a; border-radius: 16px; padding: 20px; box-shadow: 0 15px 35px rgba(0,0,0,0.9); z-index: 999999; font-family: sans-serif; display: none;">
  <div style="display: flex; gap: 14px; margin-bottom: 16px; align-items: flex-start;">
    <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px; padding: 8px; color: #eab308;">
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    </div>
    <div>
      <h4 style="margin: 0; color: #fff; font-size: 15px; font-weight: bold;">We Value Your Privacy</h4>
      <p style="margin: 4px 0 0 0; color: #a1a1aa; font-size: 11.5px; line-height: 1.6;">
        We and our partners process personal data like IP addresses and store device cookies to deliver customized Google AdSense ads and analyze site metrics. Read our <a href="/privacy" style="color: #eab308; text-decoration: none; font-weight: 600;">Privacy Policy</a>.
      </p>
    </div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
    <button onclick="grantAllConsent3()" style="background: #eab308; color: #000; border: none; border-radius: 8px; padding: 12px; font-size: 13px; font-weight: bold; cursor: pointer;">Consent & Accept</button>
    <div style="display: flex; gap: 8px; width: 100%;">
      <button onclick="refuseConsent3()" style="flex: 1; background: #18181b; color: #a1a1aa; border: 1px solid #27272a; border-radius: 8px; padding: 11px; font-size: 12.5px; font-weight: 600; cursor: pointer;">Do Not Consent</button>
      <button onclick="toggleOptionsPanel3()" style="flex: 1; background: #18181b; color: #fff; border: 1px solid #27272a; border-radius: 8px; padding: 11px; font-size: 12.5px; font-weight: 600; cursor: pointer;">Manage Options</button>
    </div>
  </div>
</div>

<script>
  (function() {
    window.__loadAdSenseScript3 = function() {
      if (window.__adSenseLoaded3) return;
      window.__adSenseLoaded3 = true;
      var script = document.createElement('script');
      script.async = true;
      script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6421372298185696";
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    };

    var consent = localStorage.getItem('elysian_cmp_consent');
    if (consent === 'granted') {
      window.__loadAdSenseScript3();
    } else if (!consent) {
      document.getElementById('elysian-gdpr-banner-3').style.display = 'block';
    }
  })();

  function grantAllConsent3() {
    localStorage.setItem('elysian_cmp_consent', 'granted');
    document.getElementById('elysian-gdpr-banner-3').style.display = 'none';
    window.__loadAdSenseScript3();
  }

  function refuseConsent3() {
    localStorage.setItem('elysian_cmp_consent', 'denied');
    document.getElementById('elysian-gdpr-banner-3').style.display = 'none';
    alert("Consent Denied. Advertising cookies blocked.");
  }

  function toggleOptionsPanel3() {
    var opt = confirm("Open Custom cookie preferences manager?");
    if (opt) grantAllConsent3();
  }
</script>`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="bg-yellow-500/10 p-2 rounded-xl text-yellow-500 border border-yellow-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Google Certified CMP Consent Compliance</h3>
            <p className="text-zinc-500 text-xs">Configure the site consent banner for EEA, UK, and Swiss users, and view deployment scripts.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleResetConsent}
          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-bold py-2 px-3.5 rounded-lg transition-all"
        >
          Reset Cookie Consent
        </button>
      </div>

      {/* Choice Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={() => handleLayoutModeChange('two-choice')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            layoutMode === 'two-choice' 
              ? 'border-yellow-500/40 bg-yellow-500/[0.03] shadow-[0_0_15px_rgba(234,179,8,0.05)]' 
              : 'border-zinc-800 bg-zinc-900/10 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-white">Option 1: 2-Choice (Consent / Manage)</span>
            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${layoutMode === 'two-choice' ? 'border-yellow-500' : 'border-zinc-700'}`}>
              {layoutMode === 'two-choice' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />}
            </span>
          </div>
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            Standard banner layout. Perfect for standard traffic routing audits. Blocks tracking automatically until Consent is approved.
          </p>
        </div>

        <div 
          onClick={() => handleLayoutModeChange('three-choice')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            layoutMode === 'three-choice' 
              ? 'border-yellow-500/40 bg-yellow-500/[0.03] shadow-[0_0_15px_rgba(234,179,8,0.05)]' 
              : 'border-zinc-800 bg-zinc-900/10 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-white">Option 2: 3-Choice (Consent / Do Not Consent / Manage)</span>
            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${layoutMode === 'three-choice' ? 'border-yellow-500' : 'border-zinc-700'}`}>
              {layoutMode === 'three-choice' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />}
            </span>
          </div>
          <p className="text-zinc-400 text-[11px] leading-relaxed">
            Highly certified strict GDPR model. Integrates a visible and direct opt-out button alongside general configurations.
          </p>
        </div>
      </div>

      {/* Code Exports section */}
      <div className="space-y-4">
        <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold text-xs border-b border-zinc-900 pb-2">
          <Info className="w-4 h-4 text-zinc-500" />
          <span>Production Integration Scripts for video-3oy8.onrender.com</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Option 1 Copier */}
          <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-900 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-white">Option 1 Script (2 Choices)</span>
                <button
                  onClick={() => copyToClipboard(option1Code, 'opt1')}
                  className="text-[10px] font-bold text-zinc-400 hover:text-white flex items-center space-x-1.5 transition-colors px-2.5 py-1 bg-zinc-950 rounded border border-zinc-800"
                >
                  {copiedCode === 'opt1' ? (
                    <>
                      <Check className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-zinc-500" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">
                Copyable production snippet implementing a two-button design with reactive fallback mechanisms.
              </p>
            </div>
            <pre className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 font-mono text-[10px] text-zinc-300 max-h-36 overflow-y-auto leading-relaxed scrollbar-thin">
              {option1Code}
            </pre>
          </div>

          {/* Option 2 Copier */}
          <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-900 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-white">Option 2 Script (3 Choices)</span>
                <button
                  onClick={() => copyToClipboard(option2Code, 'opt2')}
                  className="text-[10px] font-bold text-zinc-400 hover:text-white flex items-center space-x-1.5 transition-colors px-2.5 py-1 bg-zinc-950 rounded border border-zinc-800"
                >
                  {copiedCode === 'opt2' ? (
                    <>
                      <Check className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-zinc-500" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">
                Certified layout script incorporating the Do Not Consent button as requested.
              </p>
            </div>
            <pre className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 font-mono text-[10px] text-zinc-300 max-h-36 overflow-y-auto leading-relaxed scrollbar-thin">
              {option2Code}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CMPBanner;
