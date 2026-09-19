import React, { useState, useEffect } from 'react';
import { User, MediaItem, UserRole, TalentProfile, ActivityLog } from '../types';
import { api } from '../services/api';
import { ShieldCheck, Video, Users, PlusCircle, Edit, Trash2, X, Save, Settings, Star, MapPin, UploadCloud, Menu, ChevronDown, RefreshCw, Upload, FileJson, Briefcase, Activity, Server, DollarSign, Play, Eye, ExternalLink, HardDrive, Film, Copy, Check, Lock, Unlock, Clock, Tag, Shuffle } from 'lucide-react';
import AdminBulkUpload from '../components/AdminBulkUpload';
import AdminBulkImport from '../components/AdminBulkImport';
import AdminAds from '../components/AdminAds';
import { BulkActionBar, BulkEditModal } from '../components/AdminBulkActions';
import { CMPSandbox } from '../components/CMPBanner';

interface AdminDashboardProps {
  user: User;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  // --- State Management ---
  
  // Navigation state
  const [activeTab, setActiveTab] = useState<'media' | 'users' | 'talent' | 'bulk-upload' | 'settings' | 'import-export' | 'activity' | 'system' | 'ads'>('media');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Selection states
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedTalent, setSelectedTalent] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEntity, setBulkEntity] = useState<'media' | 'users' | 'talent'>('media');
  
  // Data state
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [talent, setTalent] = useState<TalentProfile[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [siteSettings, setSiteSettings] = useState<any>({});
  
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  // Modal visibility states
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isTalentModalOpen, setIsTalentModalOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  
  // Currently editing item states (null if creating new)
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingTalent, setEditingTalent] = useState<TalentProfile | null>(null);

  /**
   * Fetches all required administrative data from the API simultaneously.
   */
  const fetchData = async () => {
    setIsLoading(true);
    try {
        const [m, u, t, s, l] = await Promise.all([
            api.media.getAll(),
            api.users.getAll(),
            api.talent.getAll(),
            api.settings.get(),
            api.system.getActivityLogs()
        ]);
        setMedia(m);
        setUsers(u);
        setTalent(t);
        setSiteSettings(s || {});
        setActivityLogs(l);
    } catch(e) {
        console.error("Error loading admin data:", e);
    } finally {
        setIsLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => { fetchData(); }, []);

  // --- Submit Handlers ---

  const handleMediaSubmit = async (formData: any) => { 
      try {
        if (editingMedia) await api.media.update(editingMedia.id, formData); 
        else await api.media.create({ ...formData, userId: user.id }); 
        fetchData(); 
        closeMediaModal(); 
      } catch (e) { alert('Operation failed'); }
  };
  
  const handleUserSubmit = async (formData: any) => { 
      try {
        if (editingUser) await api.users.update(editingUser.id, formData); 
        else await api.users.create(formData); 
        fetchData(); 
        closeUserModal(); 
      } catch (e) { alert('Operation failed'); }
  };

  const handleTalentSubmit = async (formData: any) => { 
      try {
        if (editingTalent) await api.talent.update(editingTalent.id, formData); 
        else await api.talent.create(formData); 
        fetchData(); 
        closeTalentModal(); 
      } catch (e) { alert('Operation failed'); }
  };

  // --- Delete Handlers ---

  const handleDeleteMedia = async (id: string) => { 
      setConfirmDialog({
        isOpen: true,
        title: 'Delete Media Item',
        message: 'Are you sure you want to delete this media item? This action is irreversible.',
        onConfirm: async () => {
          await api.media.delete(id); 
          fetchData(); 
        }
      });
  };
  
  const handleDeleteTalent = async (id: string) => { 
      setConfirmDialog({
        isOpen: true,
        title: 'Delete Talent Profile',
        message: 'Are you sure you want to delete this talent profile? This action is irreversible.',
        onConfirm: async () => {
          await api.talent.delete(id); 
          fetchData(); 
        }
      });
  };
  
  const handleDeleteUser = async (id: string) => { 
      if (id === user.id) { alert("Cannot delete your own admin account."); return; } 
      setConfirmDialog({
        isOpen: true,
        title: 'Delete User Account',
        message: 'Are you sure you want to delete this user account? This action is irreversible.',
        onConfirm: async () => {
          try {
            await api.users.delete(id);
            fetchData();
          } catch (e) { alert('Operation failed'); }
        }
      });
  };
  
  // --- Modal Toggle Helpers ---

  const openMediaModal = (m: MediaItem | null = null) => { setEditingMedia(m); setIsMediaModalOpen(true); };
  const closeMediaModal = () => { setIsMediaModalOpen(false); setEditingMedia(null); };
  
  const openUserModal = (u: User | null = null) => { setEditingUser(u); setIsUserModalOpen(true); };
  const closeUserModal = () => { setIsUserModalOpen(false); setEditingUser(null); };
  
  const openTalentModal = (t: TalentProfile | null = null) => { setEditingTalent(t); setIsTalentModalOpen(true); };
  const closeTalentModal = () => { setIsTalentModalOpen(false); setEditingTalent(null); };

  // --- Site Settings Helpers ---

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { 
      const { name, value, type } = e.target;
      const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
      setSiteSettings((prev: any) => ({ ...prev, [name]: val })); 
  };
  
  const saveSettings = async () => { 
      await api.settings.update(siteSettings); 
      alert('Site settings saved successfully!'); 
  };

  // --- Data Filtering ---

  const getFilteredData = () => {
      const term = searchTerm.toLowerCase();
      switch(activeTab) {
          case 'media': return media.filter(m => 
            m.title.toLowerCase().includes(term) ||
            (m.description || '').toLowerCase().includes(term) ||
            (m.tags || []).some((t: string) => t.toLowerCase().includes(term))
          );
          case 'users': return users.filter(u => u.name.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term));
          case 'talent': return talent.filter(t => t.name.toLowerCase().includes(term));
          default: return [];
      }
  };
  const filteredData = getFilteredData();

  // Navigation Items Configuration
  const navItems = [
      { id: 'media', label: 'Media Library', icon: Video },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'ads', label: 'Google Ads', icon: DollarSign },
      { id: 'bulk-upload', label: 'Bulk Upload', icon: Upload },
      { id: 'talent', label: 'Talent', icon: Briefcase },
      { id: 'settings', label: 'Site Settings', icon: Settings },
      { id: 'import-export', label: 'Import/Export', icon: FileJson },
      { id: 'activity', label: 'Activity Log', icon: Activity },
      { id: 'system', label: 'System Status', icon: Server },
  ];

  if (isLoading && media.length === 0) return <div className="p-8 text-center text-zinc-500 font-medium">Loading administrative data...</div>;

  return (
    <div className="flex flex-col md:flex-row gap-6 lg:gap-8 pb-10">
      
      {/* --- Mobile Navigation Menu --- */}
      <div className="md:hidden relative z-20">
          <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-white flex items-center">
                  <ShieldCheck className="w-6 h-6 mr-2 text-yellow-400" /> Admin
              </h1>
              <MongoStatusBadge />
          </div>
          <button 
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-full bg-[#111] border border-zinc-800 rounded-xl p-4 flex justify-between items-center text-white active:scale-[0.98] transition-transform"
          >
              <span className="flex items-center font-bold">
                  {React.createElement(navItems.find(i => i.id === activeTab)?.icon || ShieldCheck, { className: "w-5 h-5 mr-3 text-yellow-500" })}
                  {navItems.find(i => i.id === activeTab)?.label}
              </span>
              <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isMobileMenuOpen && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-black border border-zinc-800 rounded-xl shadow-2xl p-2 space-y-1 z-30">
                  {navItems.map(item => (
                      <button
                          key={item.id}
                          type="button"
                          onClick={() => { setActiveTab(item.id as any); setIsMobileMenuOpen(false); }}
                          className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center ${
                              activeTab === item.id ? 'bg-yellow-500 text-zinc-900 font-bold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                          }`}
                      >
                          <item.icon className="w-5 h-5 mr-3" />
                          {item.label}
                      </button>
                  ))}
              </div>
          )}
      </div>

      {/* --- Desktop Sidebar Navigation --- */}
      <div className="hidden md:block w-64 flex-shrink-0 space-y-6">
          <div>
              <div className="flex items-center justify-between mb-2">
                  <h1 className="text-2xl font-bold text-white flex items-center">
                      <ShieldCheck className="w-6 h-6 mr-3 text-yellow-400" /> Admin
                  </h1>
              </div>
              <p className="text-zinc-400 text-sm mb-3">Manage platform content, users, and site settings.</p>
              <MongoStatusBadge />
          </div>
          <div className="flex flex-col space-y-2">
              {navItems.map(item => (
                   <button 
                      key={item.id}
                      type="button" 
                      onClick={() => setActiveTab(item.id as any)} 
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center w-full ${
                          activeTab === item.id 
                          ? 'bg-yellow-500 text-zinc-900 shadow-sm font-bold' 
                          : 'text-zinc-400 hover:bg-[#111] hover:text-white border border-transparent hover:border-zinc-800'
                      }`}
                  >
                      <item.icon className="w-5 h-5 mr-3" /> 
                      {item.label}
                  </button>
              ))}
          </div>
      </div>
      
      {/* --- Main Content Area --- */}
      <div className="flex-1 min-w-0 space-y-6 z-10">
          
          {/* Search and Action Bar */}
          {['media', 'users', 'talent'].includes(activeTab) && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#111]/30 p-4 rounded-2xl border border-zinc-800/50">
                <input 
                    type="text" 
                    placeholder={`Search ${activeTab}...`} 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="bg-black border border-zinc-800 rounded-full py-2.5 px-5 text-sm text-zinc-200 focus:outline-none focus:border-yellow-500 w-full sm:w-auto min-w-[250px]" 
                />
                
                {activeTab === 'media' && (
                    <button type="button" onClick={() => openMediaModal()} className="flex items-center bg-yellow-500 hover:bg-yellow-600 text-zinc-900 px-5 py-2.5 rounded-full text-sm font-bold w-full sm:w-auto justify-center transition-all">
                        <PlusCircle className="w-4 h-4 mr-2" /> Add Media
                    </button>
                )}
                {activeTab === 'users' && (
                    <button type="button" onClick={() => openUserModal()} className="flex items-center bg-yellow-500 hover:bg-yellow-600 text-zinc-900 px-5 py-2.5 rounded-full text-sm font-bold w-full sm:w-auto justify-center transition-all">
                        <PlusCircle className="w-4 h-4 mr-2" /> Add User
                    </button>
                )}
                {activeTab === 'talent' && (
                    <button type="button" onClick={() => openTalentModal()} className="flex items-center bg-yellow-500 hover:bg-yellow-600 text-zinc-900 px-5 py-2.5 rounded-full text-sm font-bold w-full sm:w-auto justify-center transition-all">
                        <PlusCircle className="w-4 h-4 mr-2" /> Add Talent
                    </button>
                )}
            </div>
          )}
          
          {/* Tab Content Routing */}
          {activeTab === 'bulk-upload' ? (
            <AdminBulkUpload user={user} onComplete={() => { setActiveTab('media'); fetchData(); }} />
          ) : activeTab === 'import-export' ? (
            <AdminBulkImport onImported={() => { setActiveTab('media'); fetchData(); }} />
          ) : activeTab === 'ads' ? (
            <AdminAds
              settings={siteSettings}
              onChange={(patch) => setSiteSettings((prev: any) => ({ ...prev, ...patch }))}
              onSave={saveSettings}
            />
          ) : activeTab === 'activity' ? (
            <ActivityLogPanel logs={activityLogs} />
          ) : activeTab === 'system' ? (
            <SystemStatusPanel />
          ) : (
            <div className="bg-[#111]/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
              {activeTab === 'media' && (
                <MediaTable 
                  media={filteredData} 
                  onView={(item: MediaItem) => setPreviewMedia(item)}
                  onEdit={openMediaModal} 
                  onDelete={handleDeleteMedia} 
                  selected={selectedMedia}
                  onToggleSelect={(id: string, customSet?: Set<string>) => {
                    if (customSet) {
                      setSelectedMedia(customSet);
                    } else {
                      const next = new Set(selectedMedia);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      setSelectedMedia(next);
                    }
                  }}
                  onToggleAll={(checked: boolean) => {
                    if (checked) setSelectedMedia(new Set(filteredData.map(m => m.id)));
                    else setSelectedMedia(new Set());
                  }}
                />
              )}
              {activeTab === 'users' && (
                <UserTable 
                  users={filteredData as User[]} 
                  onEdit={openUserModal} 
                  onDelete={handleDeleteUser}
                  selected={selectedUsers}
                  onToggleSelect={(id: string, customSet?: Set<string>) => {
                    if (customSet) {
                      setSelectedUsers(customSet);
                    } else {
                      const next = new Set(selectedUsers);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      setSelectedUsers(next);
                    }
                  }}
                  onToggleAll={(checked: boolean) => {
                    if (checked) setSelectedUsers(new Set(filteredData.map(u => u.id)));
                    else setSelectedUsers(new Set());
                  }}
                />
              )}
              {activeTab === 'talent' && (
                <TalentTable 
                  talent={filteredData as TalentProfile[]} 
                  onEdit={openTalentModal} 
                  onDelete={handleDeleteTalent}
                  selected={selectedTalent}
                  onToggleSelect={(id: string, customSet?: Set<string>) => {
                    if (customSet) {
                      setSelectedTalent(customSet);
                    } else {
                      const next = new Set(selectedTalent);
                      if (next.has(id)) next.delete(id); else next.add(id);
                      setSelectedTalent(next);
                    }
                  }}
                  onToggleAll={(checked: boolean) => {
                    if (checked) setSelectedTalent(new Set(filteredData.map(t => t.id)));
                    else setSelectedTalent(new Set());
                  }}
                />
              )}
              {activeTab === 'settings' && (
                <SiteSettingsPanel 
                  media={media} 
                  settings={siteSettings} 
                  onSettingsChange={handleSettingsChange} 
                  onSaveSettings={saveSettings} 
                />
              )}
            </div>
          )}
      </div>

      {/* --- Bulk Action Bar & Modals --- */}
      <BulkActionBar
        count={
          activeTab === 'media' ? selectedMedia.size :
          activeTab === 'users' ? selectedUsers.size :
          activeTab === 'talent' ? selectedTalent.size : 0
        }
        onClear={() => {
          if (activeTab === 'media') setSelectedMedia(new Set());
          if (activeTab === 'users') setSelectedUsers(new Set());
          if (activeTab === 'talent') setSelectedTalent(new Set());
        }}
        onEdit={() => {
          if (activeTab === 'media') { setBulkEntity('media'); setBulkEditOpen(true); }
          else if (activeTab === 'users') { setBulkEntity('users'); setBulkEditOpen(true); }
          else if (activeTab === 'talent') { setBulkEntity('talent'); setBulkEditOpen(true); }
        }}
        onDelete={() => {
          const selectedCount = activeTab === 'media' ? selectedMedia.size :
                                activeTab === 'users' ? selectedUsers.size :
                                activeTab === 'talent' ? selectedTalent.size : 0;
          if (selectedCount === 0) return;
          setConfirmDialog({
            isOpen: true,
            title: `Delete Selected Items`,
            message: `Are you sure you want to delete the ${selectedCount} selected item(s)? This action is irreversible.`,
            onConfirm: async () => {
              setIsBulkDeleting(true);
              try {
                if (activeTab === 'media' && selectedMedia.size) { 
                  await api.media.bulkDelete([...selectedMedia]); 
                  setSelectedMedia(new Set()); 
                } else if (activeTab === 'users' && selectedUsers.size) { 
                  await api.users.bulkDelete([...selectedUsers]); 
                  setSelectedUsers(new Set()); 
                } else if (activeTab === 'talent' && selectedTalent.size) { 
                  await api.talent.bulkDelete([...selectedTalent]); 
                  setSelectedTalent(new Set()); 
                }
                await fetchData();
              } catch (err) {
                console.error("Bulk delete failed", err);
                alert("Bulk delete failed");
              } finally {
                setIsBulkDeleting(false);
              }
            }
          });
        }}
        totalInLibrary={
          activeTab === 'media' ? media.length :
          activeTab === 'users' ? users.length :
          activeTab === 'talent' ? talent.length : 0
        }
        onSelectAll={
          activeTab === 'media' ? () => setSelectedMedia(new Set(media.map(m => m.id))) :
          activeTab === 'users' ? () => setSelectedUsers(new Set(users.map(u => u.id))) :
          activeTab === 'talent' ? () => setSelectedTalent(new Set(talent.map(t => t.id))) : undefined
        }
        onAutoCategorize={
          activeTab === 'media' && selectedMedia.size > 0
            ? async () => {
                setIsAutoCategorizing(true);
                try {
                  const res = await api.media.autoCategorize([...selectedMedia]);
                  if (res.success) {
                    setSelectedMedia(new Set());
                    await fetchData();
                    if (res.mode === 'fallback') {
                      alert(`Successfully auto-categorized ${res.updated} items using rule-based tags (Gemini was unavailable: ${res.error || 'quota exceeded'}).`);
                    } else {
                      alert(`Successfully auto-categorized ${res.updated} items using Gemini AI!`);
                    }
                  } else {
                    alert('Failed to auto-categorize media items.');
                  }
                } catch (err: any) {
                  console.error('Error auto-categorizing media:', err);
                  alert(`Error auto-categorizing: ${err.message}`);
                } finally {
                  setIsAutoCategorizing(false);
                }
              }
            : undefined
        }
        isAutoCategorizing={isAutoCategorizing}
      />

      {isBulkDeleting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-[100]">
          <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(234,179,8,0.3)]"></div>
          <p className="text-xl font-bold text-white tracking-wide">Executing Bulk Operation...</p>
          <p className="text-zinc-500 text-sm mt-2">Updating repository and database records...</p>
        </div>
      )}

      <BulkEditModal
        isOpen={bulkEditOpen}
        count={bulkEntity === 'media' ? selectedMedia.size : bulkEntity === 'users' ? selectedUsers.size : selectedTalent.size}
        entityType={bulkEntity}
        onClose={() => setBulkEditOpen(false)}
        onSubmit={async (updates) => {
          if (bulkEntity === 'media') await api.media.bulkUpdate([...selectedMedia], updates);
          if (bulkEntity === 'users') await api.users.bulkUpdate([...selectedUsers], updates);
          if (bulkEntity === 'talent') await api.talent.bulkUpdate([...selectedTalent], updates);
          setSelectedMedia(new Set());
          setSelectedUsers(new Set());
          setSelectedTalent(new Set());
          fetchData();
        }}
      />

      {previewMedia && (
        <VideoPreviewModal 
          media={previewMedia} 
          onClose={() => setPreviewMedia(null)} 
          onEdit={(item) => {
            setPreviewMedia(null);
            openMediaModal(item);
          }}
          onDelete={(id) => {
            setPreviewMedia(null);
            handleDeleteMedia(id);
          }}
        />
      )}

       {isMediaModalOpen && <MediaFormModal media={editingMedia} onClose={closeMediaModal} onSubmit={handleMediaSubmit} currentUser={user}/>}
      {isUserModalOpen && <UserFormModal user={editingUser} onClose={closeUserModal} onSubmit={handleUserSubmit} />}
      {isTalentModalOpen && <TalentFormModal talent={editingTalent} onClose={closeTalentModal} onSubmit={handleTalentSubmit} />}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#111] border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-6 animate-fade-in-up">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">{confirmDialog.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold border border-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  confirmDialog.onConfirm();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-red-900/20"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Sub-components for Tables & Panels ---

const MediaTable = ({ media, onView, onEdit, onDelete, selected, onToggleSelect, onToggleAll }: any) => {
  const [lastSelectedIndex, setLastSelectedIndex] = React.useState<number | null>(null);
  const allSelected = media.length > 0 && media.every((m: MediaItem) => selected.has(m.id));

  const handleCheckboxClick = (index: number, id: string, e: React.MouseEvent<HTMLInputElement>) => {
    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const sliceIds = media.slice(start, end + 1).map((m: MediaItem) => m.id);
      const shouldSelect = !selected.has(id);
      
      const nextSelected = new Set(selected);
      sliceIds.forEach((sid: string) => {
        if (shouldSelect) {
          nextSelected.add(sid);
        } else {
          nextSelected.delete(sid);
        }
      });
      onToggleSelect(id, nextSelected);
    } else {
      onToggleSelect(id);
    }
    setLastSelectedIndex(index);
  };

  return (
    <div>
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto bg-[#111]/30 rounded-2xl border border-zinc-800/80">
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-400 uppercase bg-black/40 border-b border-zinc-800/80">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} className="w-4 h-4 accent-yellow-500 cursor-pointer" />
              </th>
              <th className="px-6 py-3">Thumbnail</th>
              <th className="px-6 py-3">Title & Type</th>
              <th className="px-6 py-3">Mode</th>
              <th className="px-6 py-3">Creator</th>
              <th className="px-6 py-3">Price / Tier</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/60">
            {media.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                  <Film className="w-10 h-10 mx-auto mb-2 opacity-30 text-zinc-400" />
                  No media items found. Click &quot;Add Media&quot; to begin.
                </td>
              </tr>
            ) : (
              media.map((item: MediaItem, index: number) => (
                <tr key={item.id} className={`hover:bg-zinc-900/40 transition-colors ${selected.has(item.id) ? 'bg-yellow-500/5' : ''}`}>
                  <td className="px-4 py-4">
                    <input 
                      type="checkbox" 
                      checked={selected.has(item.id)} 
                      onClick={(e) => handleCheckboxClick(index, item.id, e as any)}
                      onChange={() => {}}
                      className="w-4 h-4 accent-yellow-500 cursor-pointer" 
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div onClick={() => onView?.(item)} className="relative w-16 h-10 bg-zinc-950 rounded border border-zinc-800/80 overflow-hidden cursor-pointer flex-shrink-0 group">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">No preview</div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-current" />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white max-w-[200px] truncate">{item.title}</div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold mt-1 tracking-wider">{item.mediaType}</div>
                  </td>
                  <td className="px-6 py-4">
                    {item.playbackMode === 'external' ? (
                      <span className="inline-flex items-center text-amber-400 text-xs font-medium"><ExternalLink className="w-3.5 h-3.5 mr-1" /> External Link</span>
                    ) : (
                      <span className="inline-flex items-center text-blue-400 text-xs font-medium"><HardDrive className="w-3.5 h-3.5 mr-1" /> Local Stream</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-zinc-300">{item.creatorName}</td>
                  <td className="px-6 py-4">
                    {item.isPremium ? (
                      <span className="text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">R {item.price}</span>
                    ) : (
                      <span className="text-xs font-medium text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">Free</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => onView?.(item)} className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"><Eye className="w-4 h-4" /></button>
                      <button type="button" onClick={() => onEdit(item)} className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"><Edit className="w-4 h-4" /></button>
                      <button type="button" onClick={() => onDelete(item.id)} className="p-1.5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile-First Layout */}
      <div className="md:hidden divide-y divide-zinc-800/60 bg-[#111]/30 rounded-2xl border border-zinc-800/80 overflow-hidden">
        {media.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <Film className="w-10 h-10 mx-auto mb-2 opacity-30 text-zinc-400" />
            No media found.
          </div>
        ) : (
          media.map((item: MediaItem, index: number) => (
            <div key={item.id} className={`p-4 space-y-3 transition-colors ${selected.has(item.id) ? 'bg-yellow-500/5' : ''}`}>
              <div className="flex items-start gap-3">
                <input 
                  type="checkbox" 
                  checked={selected.has(item.id)} 
                  onClick={(e) => handleCheckboxClick(index, item.id, e as any)}
                  onChange={() => {}}
                  className="w-4 h-4 accent-yellow-500 rounded mt-1 cursor-pointer flex-shrink-0" 
                />
                <div onClick={() => onView?.(item)} className="relative w-20 h-12 bg-zinc-950 border border-zinc-800/80 rounded overflow-hidden flex-shrink-0 cursor-pointer">
                  {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-700">No img</div>}
                  <div className="absolute bottom-1 right-1 bg-black/80 text-[9px] font-mono px-1 rounded text-zinc-300">{item.duration}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate cursor-pointer hover:text-yellow-400" onClick={() => onView?.(item)}>{item.title}</div>
                  <div className="text-[10px] text-zinc-400 font-medium mt-0.5">{item.creatorName}</div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {item.isPremium ? (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">R {item.price}</span>
                    ) : (
                      <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Free</span>
                    )}
                    {item.playbackMode === 'external' ? (
                      <span className="text-[10px] text-amber-400 flex items-center bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800"><ExternalLink className="w-3 h-3 mr-1" /> External</span>
                    ) : (
                      <span className="text-[10px] text-blue-400 flex items-center bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800"><HardDrive className="w-3 h-3 mr-1" /> Local</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-900/40">
                <button type="button" onClick={() => onView?.(item)} className="flex-1 py-1.5 px-3 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 border border-zinc-800 transition-colors">
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
                <button type="button" onClick={() => onEdit(item)} className="flex-1 py-1.5 px-3 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 border border-zinc-800 transition-colors">
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
                <button type="button" onClick={() => onDelete(item.id)} className="py-1.5 px-2 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg transition-colors border border-red-500/10">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const UserTable = ({ users, onEdit, onDelete, selected, onToggleSelect, onToggleAll }: any) => {
  const allSelected = users.length > 0 && users.every((u: User) => selected.has(u.id));
  return (
    <div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-400 uppercase bg-[#111]/80 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} className="w-4 h-4 accent-yellow-500 cursor-pointer" />
              </th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {users.map((user: User) => (
              <tr key={user.id} className={`hover:bg-zinc-900/60 transition-colors ${selected.has(user.id) ? 'bg-yellow-500/10' : ''}`}>
                <td className="px-4 py-4">
                  <input type="checkbox" checked={selected.has(user.id)} onChange={() => onToggleSelect(user.id)} className="w-4 h-4 accent-yellow-500 cursor-pointer" />
                </td>
                <td className="px-6 py-4 font-semibold text-white">{user.name}</td>
                <td className="px-6 py-4">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button type="button" onClick={() => onEdit(user)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                  <button type="button" onClick={() => onDelete(user.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-zinc-800">
        {users.map((user: User) => (
          <div key={user.id} className={`p-4 space-y-2 ${selected.has(user.id) ? 'bg-yellow-500/10' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={selected.has(user.id)} onChange={() => onToggleSelect(user.id)} className="w-4 h-4 accent-yellow-500 cursor-pointer" />
                <span className="text-white font-semibold text-sm">{user.name}</span>
              </div>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                {user.role}
              </span>
            </div>
            <p className="text-xs text-zinc-400 pl-6">{user.email}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => onEdit(user)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg"><Edit className="w-4 h-4" /></button>
              <button type="button" onClick={() => onDelete(user.id)} className="p-2 bg-red-500/10 text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TalentTable = ({ talent, onEdit, onDelete, selected, onToggleSelect, onToggleAll }: any) => {
  const allSelected = talent.length > 0 && talent.every((t: TalentProfile) => selected.has(t.id));
  return (
    <div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-left text-zinc-400">
          <thead className="text-xs text-zinc-400 uppercase bg-[#111]/80 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} className="w-4 h-4 accent-yellow-500 cursor-pointer" />
              </th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Rate</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {talent.map((item: TalentProfile) => (
              <tr key={item.id} className={`hover:bg-zinc-900/60 transition-colors ${selected.has(item.id) ? 'bg-yellow-500/10' : ''}`}>
                <td className="px-4 py-4">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => onToggleSelect(item.id)} className="w-4 h-4 accent-yellow-500 cursor-pointer" />
                </td>
                <td className="px-6 py-4 font-semibold text-white">{item.name}</td>
                <td className="px-6 py-4">{item.category}</td>
                <td className="px-6 py-4">R {item.hourlyRate}/hr</td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button type="button" onClick={() => onEdit(item)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                  <button type="button" onClick={() => onDelete(item.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-zinc-800">
        {talent.map((item: TalentProfile) => (
          <div key={item.id} className={`p-4 space-y-2 ${selected.has(item.id) ? 'bg-yellow-500/10' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => onToggleSelect(item.id)} className="w-4 h-4 accent-yellow-500 cursor-pointer" />
                <span className="text-white font-semibold text-sm">{item.name}</span>
              </div>
              <span className="text-xs font-semibold text-yellow-400">R {item.hourlyRate}/hr</span>
            </div>
            <p className="text-xs text-zinc-400 pl-6">{item.category}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => onEdit(item)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg"><Edit className="w-4 h-4" /></button>
              <button type="button" onClick={() => onDelete(item.id)} className="p-2 bg-red-500/10 text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SiteSettingsPanel = ({ media, settings, onSettingsChange, onSaveSettings }: any) => {
  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-white">Global Site Control</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-zinc-300 mb-2">Site Name</label>
          <input
            type="text"
            name="siteName"
            value={settings.siteName || ''}
            onChange={onSettingsChange}
            placeholder="Elysian"
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-300 mb-2">Hero Headline</label>
          <input
            type="text"
            name="heroHeadline"
            value={settings.heroHeadline || ''}
            onChange={onSettingsChange}
            placeholder="Midnight in Paris: The Collection"
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-zinc-300 mb-2">Announcement Banner</label>
          <input
            type="text"
            name="announcementBanner"
            value={settings.announcementBanner || ''}
            onChange={onSettingsChange}
            placeholder="Leave empty to hide"
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-300 mb-2">Maintenance Mode</label>
          <select
            name="maintenanceMode"
            value={settings.maintenanceMode ? 'on' : 'off'}
            onChange={(e) => onSettingsChange({ target: { name: 'maintenanceMode', value: e.target.value === 'on' } } as any)}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 cursor-pointer"
          >
            <option value="off">Off - site live</option>
            <option value="on">On - show maintenance page</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-300 mb-2">Default Subscription Price (ZAR)</label>
          <input
            type="number"
            name="defaultSubPrice"
            value={settings.defaultSubPrice || ''}
            onChange={onSettingsChange}
            placeholder="150"
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-300 mb-2">Smart Rotate Content Mode</label>
          <select
            name="rotationMode"
            value={settings.rotationMode || 'off'}
            onChange={onSettingsChange}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 cursor-pointer"
          >
            <option value="off">Off - standard listing</option>
            <option value="shuffle">Shuffle - random dynamic sorting</option>
            <option value="roundRobin">Round-robin - sequential chronological offset</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-300 mb-2">Manual Content Shuffle</label>
          <button
            type="button"
            onClick={() => {
              const newSeed = Math.random().toString(36).substring(2, 15);
              onSettingsChange({ target: { name: 'rotationSeed', value: newSeed } } as any);
              alert("Content seed shuffled! Be sure to click 'Save Global Settings' to save this seed.");
            }}
            className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-3 text-yellow-500 font-semibold transition-colors flex items-center justify-center space-x-2"
          >
            <Shuffle className="w-5 h-5 animate-spin-slow" />
            <span>Shuffle Content Now</span>
          </button>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-zinc-300 mb-2">Featured Hero Video</label>
          <select
            name="featuredMediaId"
            value={settings.featuredMediaId || ''}
            onChange={onSettingsChange}
            className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 cursor-pointer"
          >
            <option value="">-- None --</option>
            {media.map((m: MediaItem) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-800">
        <button
          type="button"
          onClick={onSaveSettings}
          className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold px-6 py-3 rounded-xl transition-colors flex items-center space-x-2"
        >
          <Save className="w-5 h-5" />
          <span>Save Global Settings</span>
        </button>
      </div>
    </div>
  );
};

const ActivityLogPanel = ({ logs }: { logs: ActivityLog[] }) => (
  <div className="bg-[#111]/40 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
    <h3 className="text-lg font-bold text-white">Activity Log</h3>
    <div className="space-y-2 max-h-[600px] overflow-y-auto">
      {logs.map((log) => (
        <div key={log.id} className="bg-black/40 border border-zinc-900 rounded-xl p-4 flex justify-between items-center text-sm">
          <div>
            <span className="font-semibold text-white uppercase text-xs px-2 py-0.5 rounded bg-zinc-800 mr-3">{log.action}</span>
            <span className="text-zinc-300">{log.details}</span>
          </div>
          <span className="text-xs text-zinc-500">{new Date(log.timestamp).toLocaleString()}</span>
        </div>
      ))}
    </div>
  </div>
);

const MongoStatusBadge: React.FC = () => {
  const [status, setStatus] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.system.getStatus();
      setStatus(s);
    } catch (e) {
      setStatus({ mongo: { connected: false, error: "Failed to fetch status" } });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 15000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  const connected = !!status?.mongo?.connected;
  const schemaReady = !!status?.schema?.ready;

  const dotColor = connected
    ? schemaReady
      ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]"
      : "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.7)]"
    : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]";

  const label = connected
    ? schemaReady
      ? "MongoDB Connected"
      : "MongoDB Connected (schema incomplete)"
    : "MongoDB Offline";

  return (
    <div
      className="flex items-center space-x-2 bg-[#111] border border-zinc-800 rounded-full px-3 py-1.5 text-xs font-medium"
      title={
        status
          ? `Host: ${status.mongo?.host || "—"}\nDB: ${status.mongo?.database || "—"}\nPing: ${status.mongo?.pingMs != null ? status.mongo.pingMs + "ms" : "—"}\nStorage: ${status.storage?.mode}\nUptime: ${status.uptime}s`
          : "Loading status..."
      }
    >
      <span className={`w-2.5 h-2.5 rounded-full ${dotColor} animate-pulse`} />
      <span className="text-zinc-300 hidden sm:inline">{label}</span>
      <button
        type="button"
        onClick={fetchStatus}
        aria-label="Refresh Mongo status"
        className="p-0.5 text-zinc-500 hover:text-white transition-colors"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
};

const SystemStatusPanel: React.FC = () => {
  const [status, setStatus] = React.useState<any>(null);
  React.useEffect(() => {
    const load = () => api.system.getStatus().then(setStatus).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (!status) return <div className="p-8 text-zinc-500">Loading system status...</div>;

  const ok = status.mongo?.connected;
  return (
    <div className="p-6 space-y-6 bg-[#111]/40 border border-zinc-800/80 rounded-2xl">
      <div className="flex items-center space-x-3">
        <span className={`w-3 h-3 rounded-full ${ok ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
        <h3 className="text-lg font-bold text-white">
          {ok ? "MongoDB Online" : "MongoDB Offline"}
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoRow label="Database Host" value={status.mongo?.host || "—"} />
        <InfoRow label="Database Name" value={status.mongo?.database || "—"} />
        <InfoRow label="Ping Time" value={status.mongo?.pingMs != null ? `${status.mongo.pingMs}ms` : "—"} />
        <InfoRow label="Storage Mode" value={status.storage?.mode || "—"} />
        <InfoRow label="GridFS Uplink" value={status.storage?.gridfs ? "Active" : "Inactive"} />
        <InfoRow label="Admin Access Guard" value={status.adminGuard ? "Strict PIN Verification" : "PIN-free Development Mode"} />
        <InfoRow label="System Uptime" value={`${status.uptime} seconds`} />
      </div>

      {status.schema?.collections && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-zinc-400">Database Schema Verification</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {status.schema.collections.map((col: any) => (
              <div key={col.name} className="flex items-center justify-between bg-black/40 border border-zinc-900 rounded-lg p-3">
                <span className="text-zinc-300 text-sm font-medium">{col.name}</span>
                <span className={`text-xs px-2 py-0.5 font-bold rounded-full ${col.exists ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {col.exists ? 'verified' : 'missing'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between bg-black/50 border border-zinc-800 rounded-lg px-4 py-2">
    <span className="text-zinc-500">{label}</span>
    <span className="text-zinc-200 font-mono truncate ml-2">{value}</span>
  </div>
);

// --- Video Preview & Form Modals ---

interface VideoPreviewModalProps {
  media: MediaItem;
  onClose: () => void;
  onEdit?: (media: MediaItem) => void;
  onDelete?: (id: string) => void;
}

const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({ media, onClose, onEdit, onDelete }) => {
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(media.sourceUrl || window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#111] border border-zinc-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[calc(100vh-2rem)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-black/40 flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0 pr-4">
            <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-white truncate max-w-md">
                {media.title}
              </h3>
              <p className="text-xs text-zinc-400 flex items-center gap-2">
                <span className="capitalize">{media.mediaType || 'Video'} Preview</span>
                <span>•</span>
                <span>ID: {media.id}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player / Media Content */}
        <div className="relative bg-black aspect-video w-full flex items-center justify-center overflow-hidden border-b border-zinc-800 flex-shrink-0 max-h-[35vh] sm:max-h-[45vh] md:max-h-[55vh]">
          {media.mediaType === 'image' ? (
            <img 
              src={media.sourceUrl || media.thumbnailUrl} 
              alt={media.title} 
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              src={media.sourceUrl}
              poster={media.thumbnailUrl}
              controls
              autoPlay
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full h-full object-contain focus:outline-none"
            >
              Your browser does not support HTML5 video streaming.
            </video>
          )}

          {/* Quick status overlays */}
          <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none">
            {media.isPremium ? (
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-500/90 text-zinc-950 backdrop-blur shadow flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Premium • R {media.price || 0}
              </span>
            ) : (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/90 text-zinc-950 backdrop-blur shadow flex items-center gap-1.5">
                <Unlock className="w-3.5 h-3.5" />
                Free Content
              </span>
            )}
            {media.duration && (
              <span className="px-2.5 py-1 text-xs font-mono rounded-full bg-black/70 text-zinc-200 border border-white/10 backdrop-blur flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {media.duration}
              </span>
            )}
          </div>
        </div>

        {/* Metadata Details & Creator Bar */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 scrollbar-thin min-h-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              {media.creatorAvatar ? (
                <img src={media.creatorAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-zinc-700" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-yellow-500 border border-zinc-700">
                  {(media.creatorName || 'A')[0]}
                </div>
              )}
              <div>
                <p className="text-white font-semibold text-sm">{media.creatorName || 'Admin'}</p>
                <p className="text-xs text-zinc-400">Content Creator / Model</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold border border-zinc-800 flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied URL!' : 'Copy Stream Link'}</span>
              </button>

              <a
                href={media.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold border border-zinc-800 flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Raw</span>
              </a>

              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(media)}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Media</span>
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(media.id)}
                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>

          {/* Description & Tags */}
          {media.description && (
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Description</h4>
              <p className="text-zinc-300 text-sm leading-relaxed bg-black/40 border border-zinc-900 p-3.5 rounded-xl">
                {media.description}
              </p>
            </div>
          )}

          {media.tags && media.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {media.tags.map((tag, idx) => (
                  <span key={idx} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-black/60 border-t border-zinc-800 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-sm transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

interface MediaFormModalProps {
  media: MediaItem | null;
  onClose: () => void;
  onSubmit: (formData: any) => void;
  currentUser: User;
}

const MediaFormModal: React.FC<MediaFormModalProps> = ({ media, onClose, onSubmit, currentUser }) => {
  const [title, setTitle] = useState(media?.title || '');
  const [description, setDescription] = useState(media?.description || '');
  const [sourceUrl, setSourceUrl] = useState(media?.sourceUrl || '');
  const [playbackMode, setPlaybackMode] = useState<'external' | 'local'>(
    (media as any)?.playbackMode
    || ((media?.sourceUrl || '').startsWith('/api/files/') ? 'local' : 'external')
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(media?.thumbnailUrl || '');
  const [mediaType, setMediaType] = useState<'video' | 'image'>(media?.mediaType || 'video');
  const [duration, setDuration] = useState(media?.duration || '');
  const [tags, setTags] = useState(media?.tags ? media.tags.join(', ') : '');
  const [isPremium, setIsPremium] = useState(media?.isPremium || false);
  const [price, setPrice] = useState(media?.price?.toString() || '0');
  const [creatorName, setCreatorName] = useState(media?.creatorName || currentUser?.name || 'Admin');
  const [creatorAvatar, setCreatorAvatar] = useState(media?.creatorAvatar || currentUser?.avatarUrl || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !sourceUrl.trim()) {
      alert('Title and Source URL are required');
      return;
    }

    const tagArray = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      sourceUrl: sourceUrl.trim(),
      playbackMode,
      externalUrl: playbackMode === 'external' ? sourceUrl.trim() : undefined,
      thumbnailUrl: thumbnailUrl.trim() || (mediaType === 'video' ? 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&q=80&w=600' : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600'),
      mediaType,
      duration: duration.trim() || '10:00',
      tags: tagArray.length > 0 ? tagArray : ['exclusive', 'hd'],
      isPremium,
      price: isPremium ? Number(price) || 0 : 0,
      creatorName: creatorName.trim() || 'Admin',
      creatorAvatar: creatorAvatar.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#111] border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-auto flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 flex-shrink-0 bg-black/20">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-yellow-500" />
            <span>{media ? 'Edit Video / Media' : 'Add New Video / Media'}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin min-h-0">
            <div>
              <label htmlFor="mediaTitle" className="block mb-2 text-sm font-semibold text-zinc-300">
                Title *
              </label>
              <input
                id="mediaTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Exclusive Video Title"
                required
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
              />
            </div>

          <div>
            <label htmlFor="sourceUrl" className="block mb-2 text-sm font-semibold text-zinc-300">Source URL (Video Link / Stream URL) *</label>
            <input
              id="sourceUrl"
              type="text"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://... or /api/files/..."
              required
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label htmlFor="playbackMode" className="block mb-2 text-sm font-semibold text-zinc-300">Playback Mode</label>
            <select
              id="playbackMode"
              value={playbackMode}
              onChange={(e) => setPlaybackMode(e.target.value as 'external' | 'local')}
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 cursor-pointer"
            >
              <option value="external">External Link (Redirects to Tube link / External Site)</option>
              <option value="local">Local Stream (Plays inside site using GridFS/disk upload)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="thumbnailUrl" className="block mb-2 text-sm font-semibold text-zinc-300">
                Thumbnail Image URL
              </label>
              <input
                id="thumbnailUrl"
                type="text"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://... or /api/files/..."
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
              />
            </div>

            <div>
              <label htmlFor="mediaType" className="block mb-2 text-sm font-semibold text-zinc-300">
                Media Type
              </label>
              <select
                id="mediaType"
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as 'video' | 'image')}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 cursor-pointer"
              >
                <option value="video">Video</option>
                <option value="image">Image</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="creatorName" className="block mb-2 text-sm font-semibold text-zinc-300">
                Creator / Model Name
              </label>
              <input
                id="creatorName"
                type="text"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="e.g. Amber Ray"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
              />
            </div>

            <div>
              <label htmlFor="duration" className="block mb-2 text-sm font-semibold text-zinc-300">
                Duration (e.g. 15:30)
              </label>
              <input
                id="duration"
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="10:00"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tags" className="block mb-2 text-sm font-semibold text-zinc-300">
              Tags (comma separated)
            </label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="exclusive, 4k, glamour, featured"
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label htmlFor="mediaDescription" className="block mb-2 text-sm font-semibold text-zinc-300">
              Description
            </label>
            <textarea
              id="mediaDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Content description and details..."
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center space-x-3 bg-black/40 border border-zinc-800 rounded-xl p-4">
              <input
                id="isPremium"
                type="checkbox"
                checked={isPremium}
                onChange={(e) => setIsPremium(e.target.checked)}
                className="w-5 h-5 accent-yellow-500 rounded cursor-pointer"
              />
              <label htmlFor="isPremium" className="text-sm font-semibold text-zinc-300 cursor-pointer">
                Premium Content (Paywall)
              </label>
            </div>

            {isPremium && (
              <div>
                <label htmlFor="mediaPrice" className="block mb-2 text-sm font-semibold text-zinc-300">
                  Price (ZAR)
                </label>
                <input
                  id="mediaPrice"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="50"
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
                />
              </div>
            )}
          </div>
          </div>

          <div className="flex justify-end space-x-3 p-6 border-t border-zinc-800 bg-black/40 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold transition-colors shadow"
            >
              {media ? 'Update Media' : 'Create Media'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface UserFormModalProps {
  user: User | null;
  onClose: () => void;
  onSubmit: (formData: any) => void;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ user, onClose, onSubmit }) => {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<UserRole>(user?.role || UserRole.CONSUMER);
  const [verified, setVerified] = useState(user?.verified || false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Name is required');
      return;
    }

    const payload: any = {
      name: name.trim(),
      email: email.trim(),
      role,
      verified,
      avatarUrl: avatarUrl.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
    };
    if (password) {
      payload.password = password;
    }

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#111] border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-auto flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 flex-shrink-0 bg-black/20">
          <h3 className="text-xl font-bold text-white">
            {user ? 'Edit User' : 'Add New User'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin min-h-0">
            <div>
              <label htmlFor="userName" className="block mb-2 text-sm font-semibold text-zinc-300">
                Full Name
              </label>
            <input
              id="userName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label htmlFor="userEmail" className="block mb-2 text-sm font-semibold text-zinc-300">
              Email Address
            </label>
            <input
              id="userEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label htmlFor="userRole" className="block mb-2 text-sm font-semibold text-zinc-300">
              Role
            </label>
            <select
              id="userRole"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 cursor-pointer"
            >
              <option value={UserRole.CONSUMER}>Consumer</option>
              <option value={UserRole.CREATOR}>Creator</option>
              <option value={UserRole.PROFESSIONAL}>Professional</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="userAvatar" className="block mb-2 text-sm font-semibold text-zinc-300">
              Avatar URL
            </label>
            <input
              id="userAvatar"
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div>
            <label htmlFor="userPassword" className="block mb-2 text-sm font-semibold text-zinc-300">
              {user ? 'New Password (leave blank to keep current)' : 'Password'}
            </label>
            <input
              id="userPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div className="flex items-center space-x-3 bg-black/40 border border-zinc-800 rounded-xl p-4">
            <input
              id="userVerified"
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="w-5 h-5 accent-yellow-500 rounded cursor-pointer"
            />
            <label htmlFor="userVerified" className="text-sm font-semibold text-zinc-300 cursor-pointer">
              Verified User Badge
            </label>
          </div>
          </div>

          <div className="flex justify-end space-x-3 p-6 border-t border-zinc-800 bg-black/40 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold transition-colors"
            >
              {user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface TalentFormModalProps {
  talent: TalentProfile | null;
  onClose: () => void;
  onSubmit: (formData: any) => void;
}

const TalentFormModal: React.FC<TalentFormModalProps> = ({ talent, onClose, onSubmit }) => {
  const [name, setName] = useState(talent?.name || '');
  const [title, setTitle] = useState(talent?.title || '');
  const [location, setLocation] = useState(talent?.location || 'Johannesburg, SA');
  const [hourlyRate, setHourlyRate] = useState(talent?.hourlyRate?.toString() || '1500');
  const [imageUrl, setImageUrl] = useState(talent?.imageUrl || '');
  const [verified, setVerified] = useState(talent?.verified ?? true);
  const [online, setOnline] = useState(talent?.online ?? true);
  const [availability, setAvailability] = useState<'Available Now' | 'This Week' | 'Booked'>(talent?.availability || 'Available Now');
  const [tags, setTags] = useState(talent?.tags ? talent.tags.join(', ') : 'Model, Actor');
  const [rating, setRating] = useState(talent?.rating?.toString() || '5.0');
  const [reviewCount, setReviewCount] = useState(talent?.reviewCount?.toString() || '12');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !title.trim()) {
      alert('Name and Professional Title are required');
      return;
    }

    const tagArray = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSubmit({
      name: name.trim(),
      title: title.trim(),
      location: location.trim(),
      hourlyRate: Number(hourlyRate) || 0,
      imageUrl: imageUrl.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=500',
      verified,
      online,
      availability,
      rating: Number(rating) || 5.0,
      reviewCount: Number(reviewCount) || 0,
      tags: tagArray.length > 0 ? tagArray : ['Talent'],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#111] border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-auto flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 flex-shrink-0 bg-black/20">
          <h3 className="text-xl font-bold text-white">
            {talent ? 'Edit Talent Profile' : 'Add New Talent Profile'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin min-h-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="talentName" className="block mb-2 text-sm font-semibold text-zinc-300">
                Talent Name
              </label>
              <input
                id="talentName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Elena Rostova"
                required
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
              />
            </div>

            <div>
              <label htmlFor="talentTitle" className="block mb-2 text-sm font-semibold text-zinc-300">
                Professional Title / Category
              </label>
              <input
                id="talentTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Fashion Model & Content Creator"
                required
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="talentLocation" className="block mb-2 text-sm font-semibold text-zinc-300">
                Location
              </label>
              <input
                id="talentLocation"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Johannesburg, SA"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
              />
            </div>

            <div>
              <label htmlFor="talentHourlyRate" className="block mb-2 text-sm font-semibold text-zinc-300">
                Hourly Rate (ZAR)
              </label>
              <input
                id="talentHourlyRate"
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="1500"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="talentImageUrl" className="block mb-2 text-sm font-semibold text-zinc-300">
              Profile Photo URL
            </label>
            <input
              id="talentImageUrl"
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="talentAvailability" className="block mb-2 text-sm font-semibold text-zinc-300">
                Availability
              </label>
              <select
                id="talentAvailability"
                value={availability}
                onChange={(e) => setAvailability(e.target.value as any)}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 cursor-pointer"
              >
                <option value="Available Now">Available Now</option>
                <option value="This Week">This Week</option>
                <option value="Booked">Booked</option>
              </select>
            </div>

            <div>
              <label htmlFor="talentTags" className="block mb-2 text-sm font-semibold text-zinc-300">
                Skills & Tags (comma separated)
              </label>
              <input
                id="talentTags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Model, Actor, Dancer"
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3 bg-black/40 border border-zinc-800 rounded-xl p-4">
              <input
                id="talentVerified"
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
                className="w-5 h-5 accent-yellow-500 rounded cursor-pointer"
              />
              <label htmlFor="talentVerified" className="text-sm font-semibold text-zinc-300 cursor-pointer">
                Verified Talent Badge
              </label>
            </div>

            <div className="flex items-center space-x-3 bg-black/40 border border-zinc-800 rounded-xl p-4">
              <input
                id="talentOnline"
                type="checkbox"
                checked={online}
                onChange={(e) => setOnline(e.target.checked)}
                className="w-5 h-5 accent-yellow-500 rounded cursor-pointer"
              />
              <label htmlFor="talentOnline" className="text-sm font-semibold text-zinc-300 cursor-pointer">
                Currently Online
              </label>
            </div>
          </div>
          </div>

          <div className="flex justify-end space-x-3 p-6 border-t border-zinc-800 bg-black/40 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold transition-colors"
            >
              {talent ? 'Update Profile' : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;
