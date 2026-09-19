import React, { useState } from 'react';
import { DollarSign, Save, Eye, EyeOff, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';

interface Props {
  settings: any;
  onChange: (patch: Record<string, any>) => void;
  onSave: () => Promise<void>;
}

const AdminAds: React.FC<Props> = ({ settings, onChange, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const enabled = !!settings.adsEnabled;
  const clientId = settings.adsenseClientId || '';
  const bannerSlot = settings.adsenseBannerSlot || '';
  const rectangleSlot = settings.adsenseRectangleSlot || '';
  const adsTxt = settings.adsTxtContent || '';

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await onSave();
      setStatus('AdSense settings saved successfully');
      setTimeout(() => setStatus(null), 2500);
    } catch {
      setStatus('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const patch = (key: string, value: any) => onChange({ [key]: value });

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111]/50 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-xl ${enabled ? 'bg-green-500/10 border border-green-500/30' : 'bg-zinc-800 border border-zinc-700'}`}>
            <DollarSign className={`w-5 h-5 ${enabled ? 'text-green-400' : 'text-zinc-500'}`} />
          </div>
          <div>
            <h3 className="font-bold text-white">Google AdSense Management</h3>
            <p className="text-xs text-zinc-500">{enabled ? 'Ads are active across the site' : 'Ads are currently disabled'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {status && (
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center ${status.includes('success') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> {status}
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center space-x-2 text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-[#111]/40 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
        {/* Toggle Ads Enabled */}
        <div className="flex items-center justify-between p-4 bg-black/40 border border-zinc-900 rounded-xl">
          <div>
            <h4 className="font-bold text-white">Enable Google AdSense</h4>
            <p className="text-xs text-zinc-400 mt-0.5">Globally render ad banner and rectangle units across content pages.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => patch('adsEnabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field
            label="AdSense Publisher ID (Client ID)"
            value={clientId}
            onChange={(v) => patch('adsenseClientId', v)}
            placeholder="ca-pub-XXXXXXXXXXXXXXXX"
            hint="Found in your Google AdSense dashboard (Account > Settings > Account Information)."
          />
          <Field
            label="Default Banner Ad Slot ID"
            value={bannerSlot}
            onChange={(v) => patch('adsenseBannerSlot', v)}
            placeholder="1234567890"
            hint="Numeric ad unit slot for horizontal banner placements."
          />
          <Field
            label="Default Rectangle Ad Slot ID"
            value={rectangleSlot}
            onChange={(v) => patch('adsenseRectangleSlot', v)}
            placeholder="0987654321"
            hint="Numeric ad unit slot for sidebar/rectangle grid placements."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-zinc-300">ads.txt Content</label>
            <a
              href="/ads.txt"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-yellow-500 hover:text-yellow-400 flex items-center"
            >
              <span>Preview /ads.txt</span>
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
          <textarea
            rows={4}
            value={adsTxt}
            onChange={(e) => patch('adsTxtContent', e.target.value)}
            placeholder="google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0"
            className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white font-mono text-xs focus:outline-none focus:border-yellow-500"
          />
          <p className="text-xs text-zinc-500 mt-1.5">
            Published automatically at <code className="text-yellow-500">/ads.txt</code> for crawler verification.
          </p>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}> = ({ label, value, onChange, placeholder, hint }) => (
  <div>
    <label className="block text-sm font-semibold text-zinc-300 mb-2">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 font-mono text-sm"
    />
    {hint && <p className="text-xs text-zinc-500 mt-1.5">{hint}</p>}
  </div>
);

export default AdminAds;
