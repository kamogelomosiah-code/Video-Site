import React, { useState, useEffect } from 'react';
import { AdUnit } from '../types';
import { api } from '../services/api';
import { 
  DollarSign, Save, ExternalLink, CheckCircle, Plus, Trash2, Edit2, 
  Eye, MousePointer, Percent, ToggleLeft, ToggleRight, X, RefreshCw 
} from 'lucide-react';

interface Props {
  settings: any;
  onChange: (patch: Record<string, any>) => void;
  onSave: () => Promise<void>;
}

const AdminAds: React.FC<Props> = ({ settings, onChange, onSave }) => {
  const [activeTab, setActiveTab] = useState<'custom' | 'adsense'>('custom');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Custom Ads State
  const [ads, setAds] = useState<AdUnit[]>([]);
  const [loadingAds, setLoadingAds] = useState(true);
  const [editingAd, setEditingAd] = useState<Partial<AdUnit> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const enabled = !!settings.adsEnabled;
  const clientId = settings.adsenseClientId || '';
  const bannerSlot = settings.adsenseBannerSlot || '';
  const rectangleSlot = settings.adsenseRectangleSlot || '';
  const adsTxt = settings.adsTxtContent || '';

  const fetchAds = async () => {
    setLoadingAds(true);
    try {
      const data = await api.ads.getAll();
      setAds(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load ads:', err);
    } finally {
      setLoadingAds(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  const handleSaveSettings = async () => {
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

  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAd || !editingAd.name) return;

    try {
      if (editingAd.id) {
        await api.ads.update(editingAd.id, editingAd);
      } else {
        await api.ads.create({
          ...editingAd,
          impressions: 0,
          clicks: 0,
          enabled: editingAd.enabled ?? true,
          slot: editingAd.slot || 'feed',
          type: editingAd.type || 'banner',
        });
      }
      setIsModalOpen(false);
      setEditingAd(null);
      await fetchAds();
    } catch (err) {
      console.error('Failed to save ad unit:', err);
      alert('Error saving ad unit');
    }
  };

  const handleDeleteAd = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ad unit?')) return;
    try {
      await api.ads.delete(id);
      await fetchAds();
    } catch (err) {
      console.error('Failed to delete ad unit:', err);
    }
  };

  const handleToggleAd = async (ad: AdUnit) => {
    try {
      await api.ads.update(ad.id, { enabled: !ad.enabled });
      setAds(ads.map((a) => (a.id === ad.id ? { ...a, enabled: !a.enabled } : a)));
    } catch (err) {
      console.error('Failed to toggle ad unit:', err);
    }
  };

  const patch = (key: string, value: any) => onChange({ [key]: value });

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Switching */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111]/60 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <DollarSign className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Advertising & Sponsorship Center</h3>
            <p className="text-xs text-zinc-400">Manage internal sponsor banners, native slot tracking, and AdSense.</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'custom' ? 'bg-yellow-500 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Direct Sponsors & Custom Ads ({ads.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('adsense')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'adsense' ? 'bg-yellow-500 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            AdSense & ads.txt
          </button>
        </div>
      </div>

      {activeTab === 'custom' ? (
        /* Direct Sponsors & Custom Ads */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">Active Ad Units & Placement Slots</h4>
              <p className="text-xs text-zinc-500">Track real-time impressions, clicks, and conversion CTR per placement.</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={fetchAds}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white"
                title="Refresh ad statistics"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingAd({ slot: 'feed', type: 'sponsor', enabled: true });
                  setIsModalOpen(true);
                }}
                className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-colors shadow-lg shadow-yellow-500/10"
              >
                <Plus className="w-4 h-4" />
                <span>Create Ad Unit</span>
              </button>
            </div>
          </div>

          {loadingAds ? (
            <div className="p-12 text-center text-zinc-500 text-sm bg-zinc-950 border border-zinc-900 rounded-2xl">
              Loading ad inventory...
            </div>
          ) : ads.length === 0 ? (
            <div className="p-12 text-center bg-zinc-950 border border-zinc-900 rounded-2xl">
              <p className="text-zinc-400 text-sm font-medium">No ad units configured yet.</p>
              <p className="text-xs text-zinc-600 mt-1">Add your first sponsorship campaign to monetize feed and video pages.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ads.map((ad) => {
                const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0';

                return (
                  <div key={ad.id} className="bg-[#111] border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-all">
                    <div>
                      {/* Top badges & toggle */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {ad.slot}
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleToggleAd(ad)}
                            className={`text-xs flex items-center ${ad.enabled ? 'text-green-400' : 'text-zinc-600'}`}
                            title="Toggle active"
                          >
                            {ad.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                          </button>
                        </div>
                      </div>

                      {/* Image Preview */}
                      {ad.imageUrl && (
                        <div className="w-full h-28 bg-zinc-900 rounded-xl overflow-hidden mb-3 border border-zinc-800 relative">
                          <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-cover" />
                        </div>
                      )}

                      <h5 className="font-bold text-white text-sm truncate">{ad.name}</h5>
                      <p className="text-xs text-zinc-500 capitalize">{ad.type} Placement</p>

                      {ad.targetUrl && (
                        <a
                          href={ad.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-yellow-500/80 hover:text-yellow-400 flex items-center mt-1 truncate"
                        >
                          <ExternalLink className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{ad.targetUrl}</span>
                        </a>
                      )}
                    </div>

                    {/* Stats Counter */}
                    <div className="mt-4 pt-4 border-t border-zinc-800/80 grid grid-cols-3 gap-2 text-center">
                      <div className="bg-zinc-900/60 p-2 rounded-xl border border-zinc-800">
                        <div className="flex items-center justify-center space-x-1 text-zinc-400 text-[10px] uppercase">
                          <Eye className="w-3 h-3" />
                          <span>Views</span>
                        </div>
                        <p className="text-white font-bold text-xs mt-0.5">{ad.impressions || 0}</p>
                      </div>

                      <div className="bg-zinc-900/60 p-2 rounded-xl border border-zinc-800">
                        <div className="flex items-center justify-center space-x-1 text-zinc-400 text-[10px] uppercase">
                          <MousePointer className="w-3 h-3" />
                          <span>Clicks</span>
                        </div>
                        <p className="text-white font-bold text-xs mt-0.5">{ad.clicks || 0}</p>
                      </div>

                      <div className="bg-zinc-900/60 p-2 rounded-xl border border-zinc-800">
                        <div className="flex items-center justify-center space-x-1 text-yellow-500/80 text-[10px] uppercase font-semibold">
                          <Percent className="w-3 h-3" />
                          <span>CTR</span>
                        </div>
                        <p className="text-yellow-400 font-bold text-xs mt-0.5">{ctr}%</p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 flex items-center justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAd(ad);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs flex items-center space-x-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAd(ad.id)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* AdSense Form */
        <div className="bg-[#111]/40 border border-zinc-800/80 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div>
              <h4 className="font-bold text-white">AdSense Configuration</h4>
              <p className="text-xs text-zinc-400">Configure fallback programmatic advertising tags and automatic crawler ads.txt verification.</p>
            </div>
            <div className="flex items-center space-x-3">
              {status && (
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center ${status.includes('success') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> {status}
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={saving}
                className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center space-x-2 text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </div>

          {/* Toggle Ads Enabled */}
          <div className="flex items-center justify-between p-4 bg-black/40 border border-zinc-900 rounded-xl">
            <div>
              <h4 className="font-bold text-white">Enable AdSense Fallback</h4>
              <p className="text-xs text-zinc-400 mt-0.5">Render AdSense blocks when no direct custom ad is booked for that slot.</p>
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
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111] border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {editingAd?.id ? 'Edit Ad Placement' : 'Create New Ad Unit'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingAd(null);
                }}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Campaign / Sponsor Name</label>
                <input
                  type="text"
                  required
                  value={editingAd?.name || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, name: e.target.value })}
                  placeholder="e.g. Elysian VIP Membership Sponsor"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Placement Slot</label>
                  <select
                    value={editingAd?.slot || 'feed'}
                    onChange={(e) => setEditingAd({ ...editingAd, slot: e.target.value as any })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="feed">Feed (Between Cards)</option>
                    <option value="sidebar">Sidebar (Square / Rectangle)</option>
                    <option value="video-page">Video Page (Under Player)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Creative Type</label>
                  <select
                    value={editingAd?.type || 'sponsor'}
                    onChange={(e) => setEditingAd({ ...editingAd, type: e.target.value as any })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="sponsor">Sponsor</option>
                    <option value="banner">Banner</option>
                    <option value="affiliate">Affiliate Link</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Image URL (Banner / Graphic)</label>
                <input
                  type="url"
                  value={editingAd?.imageUrl || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, imageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/... or /uploads/..."
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Target Landing Page URL</label>
                <input
                  type="url"
                  value={editingAd?.targetUrl || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, targetUrl: e.target.value })}
                  placeholder="https://sponsor.com/deal"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Custom HTML (Optional)</label>
                <textarea
                  rows={2}
                  value={editingAd?.htmlContent || ''}
                  onChange={(e) => setEditingAd({ ...editingAd, htmlContent: e.target.value })}
                  placeholder="<a href='...'>...</a>"
                  className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white font-mono text-xs focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="ad-enabled-check"
                  checked={editingAd?.enabled ?? true}
                  onChange={(e) => setEditingAd({ ...editingAd, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-800 text-yellow-500 focus:ring-yellow-500 bg-black"
                />
                <label htmlFor="ad-enabled-check" className="text-xs text-zinc-300 font-medium cursor-pointer">
                  Unit enabled and delivering impressions immediately
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingAd(null);
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-950 rounded-xl text-xs font-bold"
                >
                  Save Ad Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
