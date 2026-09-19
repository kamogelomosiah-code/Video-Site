import React, { useState, useEffect } from 'react';
import { User, MediaItem, UserRole, TalentProfile, ActivityLog } from '../types';
import { api } from '../services/api';
import { ShieldCheck, Video, Users, PlusCircle, Edit, Trash2, X, Save, Settings, Star, MapPin, UploadCloud, Menu, ChevronDown, Database as DatabaseIcon, RefreshCw, Upload, FileJson, Briefcase, Activity, Server, DollarSign } from 'lucide-react';
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
  
  // Modal visibility states
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isTalentModalOpen, setIsTalentModalOpen] = useState(false);
  
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
      if (window.confirm('Are you sure you want to delete this media?')) { 
          await api.media.delete(id); 
          fetchData(); 
      } 
  };
  
  const handleDeleteTalent = async (id: string) => { 
      if (window.confirm('Are you sure you want to delete this talent profile?')) { 
          await api.talent.delete(id); 
          fetchData(); 
      } 
  };
  
  const handleDeleteUser = async (id: string) => { 
      if (id === user.id) { alert("Cannot delete your own admin account."); return; } 
      if (window.confirm('Are you sure you want to delete this user?')) { 
          try {
            await api.users.delete(id);
            fetchData();
          } catch (e) { alert('Operation failed'); }
      } 
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
          case 'media': return media.filter(m => m.title.toLowerCase().includes(term));
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
                  onEdit={openMediaModal} 
                  onDelete={handleDeleteMedia} 
                  selected={selectedMedia}
                  onToggleSelect={(id: string) => {
                    const next = new Set(selectedMedia);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    setSelectedMedia(next);
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
                  onToggleSelect={(id: string) => {
                    const next = new Set(selectedUsers);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    setSelectedUsers(next);
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
                  onToggleSelect={(id: string) => {
                    const next = new Set(selectedTalent);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    setSelectedTalent(next);
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
        count={selectedMedia.size + selectedUsers.size + selectedTalent.size}
        onClear={() => { setSelectedMedia(new Set()); setSelectedUsers(new Set()); setSelectedTalent(new Set()); }}
        onEdit={() => {
          if (selectedMedia.size) { setBulkEntity('media'); setBulkEditOpen(true); }
          else if (selectedUsers.size) { setBulkEntity('users'); setBulkEditOpen(true); }
          else if (selectedTalent.size) { setBulkEntity('talent'); setBulkEditOpen(true); }
        }}
        onDelete={async () => {
          if (selectedMedia.size) { await api.media.bulkDelete([...selectedMedia]); setSelectedMedia(new Set()); fetchData(); }
          else if (selectedUsers.size) { await api.users.bulkDelete([...selectedUsers]); setSelectedUsers(new Set()); fetchData(); }
          else if (selectedTalent.size) { await api.talent.bulkDelete([...selectedTalent]); setSelectedTalent(new Set()); fetchData(); }
        }}
      />

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

      {isMediaModalOpen && <MediaFormModal media={editingMedia} onClose={closeMediaModal} onSubmit={handleMediaSubmit} currentUser={user}/>}
      {isUserModalOpen && <UserFormModal user={editingUser} onClose={closeUserModal} onSubmit={handleUserSubmit} />}
      {isTalentModalOpen && <TalentFormModal talent={editingTalent} onClose={closeTalentModal} onSubmit={handleTalentSubmit} />}
    </div>
  );
};

// --- Sub-components for Tables & Panels ---

const MediaTable = ({ media, onEdit, onDelete, selected, onToggleSelect, onToggleAll }: any) => {
  const allSelected = media.length > 0 && media.every((m: MediaItem) => selected.has(m.id));
  return (
    <div>
      <table className="w-full text-sm text-left text-zinc-400 hidden md:table">
        <thead className="text-xs text-zinc-400 uppercase bg-[#111]/50">
          <tr>
            <th className="px-4 py-3 w-10">
              <input type="checkbox" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} className="w-4 h-4 accent-yellow-500 cursor-pointer" />
            </th>
            <th className="px-6 py-3">Thumbnail</th>
            <th className="px-6 py-3">Title</th>
            <th className="px-6 py-3">Creator</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {media.map((item: MediaItem) => (
            <tr key={item.id} className={`border-b border-zinc-800 hover:bg-[#111] ${selected.has(item.id) ? 'bg-yellow-500/5' : ''}`}>
              <td className="px-4 py-4">
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => onToggleSelect(item.id)} className="w-4 h-4 accent-yellow-500 cursor-pointer" />
              </td>
              <td className="px-6 py-4">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.title} className="w-20 h-12 object-cover rounded-md" />
                ) : (
                  <div className="w-20 h-12 bg-zinc-800 rounded-md flex items-center justify-center text-zinc-500 text-xs">No media</div>
                )}
              </td>
              <td className="px-6 py-4 font-medium text-white max-w-[200px] truncate">{item.title}</td>
              <td className="px-6 py-4">{item.creatorName}</td>
              <td className="px-6 py-4">
                {item.isPremium
                  ? <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">Premium</span>
                  : <span className="px-2 py-1 text-xs font-medium rounded-full bg-zinc-700 text-zinc-300">Free</span>}
              </td>
              <td className="px-6 py-4 text-right space-x-2">
                <button type="button" onClick={() => onEdit(item)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                <button type="button" onClick={() => onDelete(item.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const UserTable = ({ users, onEdit, onDelete, selected, onToggleSelect, onToggleAll }: any) => {
  const allSelected = users.length > 0 && users.every((u: User) => selected.has(u.id));
  return (
    <div>
      <table className="w-full text-sm text-left text-zinc-400 hidden md:table">
        <thead className="text-xs text-zinc-400 uppercase bg-[#111]/50">
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
        <tbody>
          {users.map((user: User) => (
            <tr key={user.id} className={`border-b border-zinc-800 hover:bg-[#111] ${selected.has(user.id) ? 'bg-yellow-500/5' : ''}`}>
              <td className="px-4 py-4">
                <input type="checkbox" checked={selected.has(user.id)} onChange={() => onToggleSelect(user.id)} className="w-4 h-4 accent-yellow-500 cursor-pointer" />
              </td>
              <td className="px-6 py-4 font-medium text-white">{user.name}</td>
              <td className="px-6 py-4">{user.email}</td>
              <td className="px-6 py-4"><span className="px-2 py-1 text-xs font-semibold rounded bg-zinc-800 text-zinc-300">{user.role}</span></td>
              <td className="px-6 py-4 text-right space-x-2">
                <button type="button" onClick={() => onEdit(user)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                <button type="button" onClick={() => onDelete(user.id)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TalentTable = ({ talent, onEdit, onDelete, selected, onToggleSelect, onToggleAll }: any) => {
  const allSelected = talent.length > 0 && talent.every((t: TalentProfile) => selected.has(t.id));
  return (
    <div>
      <table className="w-full text-sm text-left text-zinc-400 hidden md:table">
        <thead className="text-xs text-zinc-400 uppercase bg-[#111]/50">
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
        <tbody>
          {talent.map((item: TalentProfile) => (
            <tr key={item.id} className={`border-b border-zinc-800 hover:bg-[#111] ${selected.has(item.id) ? 'bg-yellow-500/5' : ''}`}>
              <td className="px-4 py-4">
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => onToggleSelect(item.id)} className="w-4 h-4 accent-yellow-500 cursor-pointer" />
              </td>
              <td className="px-6 py-4 font-medium text-white">{item.name}</td>
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

export default AdminDashboard;
