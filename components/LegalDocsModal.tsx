import React from 'react';
import { X, ShieldAlert, CheckCircle, Scale, FileText } from 'lucide-react';

interface LegalDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'privacy' | 'terms';
}

const LegalDocsModal: React.FC<LegalDocsModalProps> = ({ isOpen, onClose, defaultTab = 'privacy' }) => {
  const [activeTab, setActiveTab] = React.useState<'privacy' | 'terms'>(defaultTab);

  React.useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, isOpen]);

  if (!isOpen) return null;

  return (
    <div id="legal-docs-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-900 bg-zinc-900/20 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Legal Center & Compliance</h2>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-900 px-6 bg-zinc-950 overflow-x-auto scrollbar-none flex-shrink-0">
          <button 
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`py-4 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'privacy' 
                ? 'border-yellow-500 text-yellow-500' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Privacy Policy & Cookie Statement
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`py-4 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'terms' 
                ? 'border-yellow-500 text-yellow-500' 
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Terms of Service
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-zinc-300 text-sm leading-relaxed scrollbar-thin">
          {activeTab === 'privacy' ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold text-lg mb-2">Privacy Policy & Consent Agreement</h3>
                <p className="text-zinc-400">Last updated: September 5, 2026</p>
                <p className="mt-3">
                  Elysian ("we", "us", or "our") operates the website <strong>video-3oy8.onrender.com</strong>. This policy is designed to help you understand how we collect, use, and safeguard your personal information, especially under the General Data Protection Regulation (GDPR) and the ePrivacy Directive for users residing in the European Economic Area (EEA), United Kingdom (UK), and Switzerland.
                </p>
              </div>

              <div className="p-4 bg-yellow-500/5 rounded-xl border border-yellow-500/20 flex items-start space-x-3">
                <ShieldAlert className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-400">
                  <span className="text-white font-bold block mb-1">Google Certified CMP Consent</span>
                  We employ a certified Consent Management Platform framework on video-3oy8.onrender.com. This blocks advertising, targeting, and cookie storage scripts (including Google AdSense) by default until you actively indicate your preferences.
                </div>
              </div>

              <div>
                <h4 className="text-white font-bold text-base mb-2">1. Information We Collect</h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Device Information:</strong> Browser type, operating system, IP address, and screen resolution.</li>
                  <li><strong>Usage Data:</strong> Pages visited, media playback interactions, duration of viewing, and source links.</li>
                  <li><strong>Consent State:</strong> Your cookie choices are securely logged locally via cryptographic or browser-stored preference flags.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold text-base mb-2">2. Google AdSense & Third-Party Vendors</h4>
                <p>
                  Google uses cookies to serve ads based on your prior visits to our website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to our sites and/or other sites on the Internet.
                </p>
                <p className="mt-2">
                  Users in the EEA, UK, and Switzerland have the absolute right to opt-out of personalized advertising and targeting cookies by selecting "Do Not Consent" or modifying settings in our Manage Options tab.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold text-base mb-2">3. Cookie Categories</h4>
                <div className="space-y-3">
                  <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-900">
                    <span className="font-bold text-white text-xs block mb-1">Strictly Necessary Cookies (Always Active)</span>
                    <p className="text-zinc-400 text-xs">Required to enable core system capabilities, sign-in state management, and localized age-gate parameters. Cannot be deactivated.</p>
                  </div>
                  <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-900">
                    <span className="font-bold text-white text-xs block mb-1">Performance & Analytics Cookies</span>
                    <p className="text-zinc-400 text-xs">Help us measure visitor counts, stream optimization, and route latencies to improve the user interface.</p>
                  </div>
                  <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-900">
                    <span className="font-bold text-white text-xs block mb-1">Targeting & Advertising Cookies (AdSense)</span>
                    <p className="text-zinc-400 text-xs">Used to serve relevant, personalized advertisements through Google AdSense. We block these entirely until consent is actively provided.</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-white font-bold text-base mb-2">4. Your Rights Under GDPR</h4>
                <p>
                  Under GDPR, you hold the following rights:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Right to view, inspect, or export your stored consent preferences.</li>
                  <li>Right to withdraw consent at any time without penalty.</li>
                  <li>Right to demand erasure of any local telemetry records.</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-zinc-900 flex justify-between items-center text-xs text-zinc-500">
                <span>Elysian Privacy Officer: compliance@elysian.com</span>
                <span>GDPR Compliant</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-bold text-lg mb-2">Terms of Service</h3>
                <p className="text-zinc-400">Last updated: September 5, 2026</p>
                <p className="mt-3">
                  Welcome to Elysian (the "Site"). By visiting or using video-3oy8.onrender.com, you declare that you agree to the following Terms of Service in full. Please read them carefully.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold text-base mb-2">1. Age Requirement & Restrictions</h4>
                <p>
                  Elysian contains content of an adult nature. You must be at least <strong>18 years of age</strong> (or the legal age of majority in your jurisdiction, whichever is higher) to view or interact with any media on this Site.
                </p>
                <p className="mt-2 text-yellow-500 font-semibold">
                  By bypassing our automated Age Gate and continuing to access this site, you certify under penalty of perjury that you are of legal age.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold text-base mb-2">2. Usage License & Intellectual Property</h4>
                <p>
                  All custom digital media, code, branding elements, and interface designs are the intellectual property of Elysian and its verified creators. You are granted a limited, non-transferable, and revocable license to access the content for personal, non-commercial entertainment purposes only.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold text-base mb-2">3. User Subscribed Content</h4>
                <p>
                  Subscriptions paid to specific verified adult models are non-refundable and auto-renewing unless cancelled in the account settings panel. All model bookings are subject to model confirmation and contract.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold text-base mb-2">4. Disclaimers of Warranties</h4>
                <p>
                  The website and its contents are provided on an "as is" and "as available" basis without warranties of any kind. Elysian does not guarantee that the server hosting the site will be uninterrupted or error-free.
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-900 flex justify-between items-center text-xs text-zinc-500">
                <span>Copyright &copy; 2026 Elysian</span>
                <span>Active Protection</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-zinc-900 bg-zinc-950 flex justify-end">
          <button 
            type="button"
            onClick={onClose}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-6 py-2 rounded-lg text-sm transition-all"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalDocsModal;
