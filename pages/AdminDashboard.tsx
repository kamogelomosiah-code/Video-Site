/**
 * AdminDashboard.tsx
 * 
 * This is the main administration panel for the application.
 * It provides a unified interface to manage Media, Users, Site Settings,
 * Data Imports/Exports, and System Activity Logs.
 * 
 * The layout is fully responsive, featuring a collapsible dropdown menu on mobile
 * and a persistent sidebar on desktop displays.
 */

import React, { useState, useEffect } from 'react';
import { User, MediaItem, UserRole, TalentProfile, ActivityLog } from '../types';
import { api } from '../services/api';
import { ShieldCheck, Video, Users, PlusCircle, Edit, Trash2, X, Save, Settings, Star, MapPin, UploadCloud, Menu, ChevronDown, Wand2, Database as DatabaseIcon, RefreshCw } from 'lucide-react';
import AdminBulkImport from './AdminUpload';
import { CMPSandbox } from '../components/CMPBanner';

interface AdminDashboardProps {
  user: User;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  // --- State Management ---
  
  // Navigation state
  const [activeTab, setActiveTab] = useState<'media' | 'users' | 'settings' | 'import' | 'logs' | 'system'>('media');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
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
        setSiteSettings(s);
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

  const handleSettingsChange = (e: React.ChangeEvent<HTMLSelectElement>) => { 
      setSiteSettings(prev => ({ ...prev, [e.target.name]: e.target.value })); 
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
          case 'settings': return talent.filter(t => t.name.toLowerCase().includes(term));
          default: return [];
      }
  };
  const filteredData = getFilteredData();

  // Navigation Items Configuration
  const navItems = [
      { id: 'media', label: 'Media Library', icon: Video },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'settings', label: 'Site Settings', icon: Settings },
      { id: 'import', label: 'Import/Export', icon: UploadCloud },
      { id: 'logs', label: 'Activity Log', icon: ShieldCheck },
      { id: 'system', label: 'System Status', icon: DatabaseIcon }
  ];

  if (isLoading && media.length === 0) return <div className="p-8 text-center text-zinc-500 font-medium">Loading administrative data...</div>;

  return (
    <div className="flex flex-col md:flex-row gap-6 lg:gap-8 pb-10">
      
      {/* --- Mobile Navigation Menu --- */}
      {/* Uses a collapsible dropdown instead of a wide scrolling bar for better mobile UX */}
      <div className="md:hidden relative z-20">
          <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-white flex items-center">
                  <ShieldCheck className="w-6 h-6 mr-2 text-yellow-400" /> Admin
              </h1>
              <MongoStatusBadge />
          </div>
          <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-full bg-[#111] border border-zinc-800 rounded-xl p-4 flex justify-between items-center text-white active:scale-[0.98] transition-transform"
          >
              <span className="flex items-center font-bold">
                  {React.createElement(navItems.find(i => i.id === activeTab)?.icon || ShieldCheck, { className: "w-5 h-5 mr-3 text-yellow-500" })}
                  {navItems.find(i => i.id === activeTab)?.label}
              </span>
              <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Dropdown Menu Items */}
          {isMobileMenuOpen && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-black border border-zinc-800 rounded-xl shadow-2xl p-2 space-y-1 z-30">
                  {navItems.map(item => (
                      <button
                          key={item.id}
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
          
          {/* Search and Action Bar (Only visible on specific tabs) */}
          {['media', 'users', 'settings'].includes(activeTab) && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#111]/30 p-4 rounded-2xl border border-zinc-800/50">
                <input 
                    type="text" 
                    placeholder={`Search ${activeTab === 'settings' ? 'talent...' : activeTab + '...'}`} 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="bg-black border border-zinc-800 rounded-full py-2.5 px-5 text-sm text-zinc-200 focus:outline-none focus:border-yellow-500 w-full sm:w-auto min-w-[250px]" 
                />
                
                {/* Contextual Action Buttons */}
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
            </div>
          )}
          
          {/* Tab Content Routing */}
          {activeTab === 'import' ? (
            <AdminBulkImport />
          ) : activeTab === 'logs' ? (
            <ActivityLogPanel logs={activityLogs} />
          ) : activeTab === 'system' ? (
            <SystemStatusPanel />
          ) : (
            <div className="bg-[#111]/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
              {activeTab === 'media' && <MediaTable media={filteredData} onEdit={openMediaModal} onDelete={handleDeleteMedia} />}
              {activeTab === 'users' && <UserTable users={filteredData} onEdit={openUserModal} onDelete={handleDeleteUser} />}
              {activeTab === 'settings' && <SiteSettingsPanel talent={filteredData as TalentProfile[]} media={media} settings={siteSettings} onEditTalent={openTalentModal} onDeleteTalent={handleDeleteTalent} onAddTalent={() => openTalentModal()} onSettingsChange={handleSettingsChange} onSaveSettings={saveSettings} />}
            </div>
          )}
      </div>

      {/* --- Floating Modals --- */}
      {isMediaModalOpen && <MediaFormModal media={editingMedia} onClose={closeMediaModal} onSubmit={handleMediaSubmit} currentUser={user}/>}
      {isUserModalOpen && <UserFormModal user={editingUser} onClose={closeUserModal} onSubmit={handleUserSubmit} />}
      {isTalentModalOpen && <TalentFormModal talent={editingTalent} onClose={closeTalentModal} onSubmit={handleTalentSubmit} />}
    </div>
  );
};

// ============================================================================
// Sub-components & UI Elements
// ============================================================================

/**
 * Shared action buttons (Edit/Delete) for table rows
 */
const renderActions = (onEdit: () => void, onDelete: () => void, itemType: string, itemName: string) => (
  <div className="flex justify-end space-x-2 pt-2 md:pt-0">
    <button type="button" onClick={onEdit} className="p-2 hover:bg-zinc-800 rounded-full transition-colors" aria-label={`Edit ${itemType} ${itemName}`}>
        <Edit className="w-4 h-4 text-zinc-400"/>
    </button>
    <button type="button" onClick={onDelete} className="p-2 hover:bg-zinc-800 rounded-full transition-colors" aria-label={`Delete ${itemType} ${itemName}`}>
        <Trash2 className="w-4 h-4 text-yellow-400"/>
    </button>
  </div>
);

/**
 * Table displaying all media items. Uses a list view on mobile and standard table on desktop.
 */
const MediaTable = ({ media, onEdit, onDelete }: any) => (
  <div>
    {/* Desktop View */}
    <table className="w-full text-sm text-left text-zinc-400 hidden md:table">
      <thead className="text-xs text-zinc-400 uppercase bg-[#111]/50">
          <tr>
              <th scope="col" className="px-6 py-3">Thumbnail</th>
              <th scope="col" className="px-6 py-3">Title</th>
              <th scope="col" className="px-6 py-3">Creator</th>
              <th scope="col" className="px-6 py-3">Status</th>
              <th scope="col" className="px-6 py-3 text-right">Actions</th>
          </tr>
      </thead>
      <tbody>
          {media.map((item: MediaItem) => (
              <tr key={item.id} className="border-b border-zinc-800 hover:bg-[#111]">
                  <td className="px-6 py-4">
                      {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.title} className="w-20 h-12 object-cover rounded-md"/>
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
                  <td className="px-6 py-4 text-right">
                      {renderActions(() => onEdit(item), () => onDelete(item.id), 'media', item.title)}
                  </td>
              </tr>
          ))}
      </tbody>
    </table>
    
    {/* Mobile View */}
    <div className="md:hidden space-y-4 p-4">
        {media.map((item: MediaItem) => (
            <div key={item.id} className="bg-black/50 rounded-xl p-4 border border-zinc-800/80 flex flex-col space-y-3">
                <div className="flex items-start space-x-3">
                    {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt={item.title} className="w-20 h-20 object-cover rounded-md flex-shrink-0 border border-zinc-800"/>
                    ) : (
                        <div className="w-20 h-20 bg-zinc-800 rounded-md flex-shrink-0 border border-zinc-800 flex items-center justify-center text-zinc-500 text-xs">No media</div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-white mb-1 text-sm leading-snug break-words">{item.title}</p>
                        <p className="text-xs text-zinc-400 mb-2 truncate">by {item.creatorName}</p>
                        {item.isPremium 
                            ? <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">Premium</span> 
                            : <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-zinc-700 text-zinc-300">Free</span>}
                    </div>
                </div>
                <div className="border-t border-zinc-900/60 pt-2 flex justify-end space-x-2">
                    <button type="button" onClick={() => onEdit(item)} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold flex items-center transition-all"><Edit className="w-3.5 h-3.5 mr-1 text-zinc-400"/> Edit</button>
                    <button type="button" onClick={() => onDelete(item.id)} className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg text-xs font-semibold flex items-center transition-all"><Trash2 className="w-3.5 h-3.5 mr-1"/> Delete</button>
                </div>
            </div>
        ))}
    </div>
  </div>
);

/**
 * Table displaying all registered users.
 */
const UserTable = ({ users, onEdit, onDelete }: any) => (
  <div>
    {/* Desktop View */}
    <table className="w-full text-sm text-left text-zinc-400 hidden md:table">
      <thead className="text-xs text-zinc-400 uppercase bg-[#111]/50">
          <tr>
              <th scope="col" className="px-6 py-3">User</th>
              <th scope="col" className="px-6 py-3">Role</th>
              <th scope="col" className="px-6 py-3">Status</th>
              <th scope="col" className="px-6 py-3 text-right">Actions</th>
          </tr>
      </thead>
      <tbody>
          {users.map((user: User) => (
              <tr key={user.id} className="border-b border-zinc-800 hover:bg-[#111]">
                  <td className="px-6 py-4 font-medium text-white flex items-center">
                      {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full mr-3 object-cover"/>
                      ) : (
                          <div className="w-8 h-8 rounded-full mr-3 bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {(user.name || "U").charAt(0).toUpperCase()}
                          </div>
                      )}
                      {user.name}
                  </td>
                  <td className="px-6 py-4">{user.role}</td>
                  <td className="px-6 py-4">
                      {user.verified 
                          ? <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-500 border border-green-500/20">Verified</span> 
                          : <span className="px-2 py-1 text-xs font-medium rounded-full bg-zinc-700 text-zinc-300">Unverified</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                      {renderActions(() => onEdit(user), () => onDelete(user.id), 'user', user.name)}
                  </td>
              </tr>
          ))}
      </tbody>
    </table>
    
    {/* Mobile View */}
    <div className="md:hidden space-y-4 p-4">
        {users.map((user: User) => (
            <div key={user.id} className="bg-black/50 rounded-xl p-4 border border-zinc-800/80 flex flex-col space-y-3">
                <div className="flex items-center space-x-3">
                    {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 rounded-full border border-zinc-800 flex-shrink-0 object-cover"/>
                    ) : (
                        <div className="w-12 h-12 rounded-full border border-zinc-800 bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-sm flex-shrink-0">
                            {(user.name || "U").charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm truncate">{user.name}</p>
                        <p className="text-xs text-zinc-400 mb-1">{user.role}</p>
                        {user.verified 
                            ? <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-500/10 text-green-500 border border-green-500/20 inline-block">Verified</span> 
                            : <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-zinc-700 text-zinc-300 inline-block">Unverified</span>}
                    </div>
                </div>
                <div className="border-t border-zinc-900/60 pt-2 flex justify-end space-x-2">
                    <button type="button" onClick={() => onEdit(user)} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold flex items-center transition-all"><Edit className="w-3.5 h-3.5 mr-1 text-zinc-400"/> Edit</button>
                    <button type="button" onClick={() => onDelete(user.id)} className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg text-xs font-semibold flex items-center transition-all"><Trash2 className="w-3.5 h-3.5 mr-1"/> Delete</button>
                </div>
            </div>
        ))}
    </div>
  </div>
);

/**
 * Table displaying talent profiles (used inside Site Settings)
 */
const TalentTable = ({ talent, onEdit, onDelete }: any) => (
  <div>
    <table className="w-full text-sm text-left text-zinc-400 hidden md:table">
      <thead className="text-xs text-zinc-400 uppercase bg-[#111]/50">
          <tr>
              <th scope="col" className="px-6 py-3">Name</th>
              <th scope="col" className="px-6 py-3">Location</th>
              <th scope="col" className="px-6 py-3">Rating</th>
              <th scope="col" className="px-6 py-3 text-right">Actions</th>
          </tr>
      </thead>
      <tbody>
          {talent.map((t: TalentProfile) => (
              <tr key={t.id} className="border-b border-zinc-800 hover:bg-[#111]">
                  <td className="px-6 py-4 font-medium text-white flex items-center">
                      {t.imageUrl ? (
                          <img src={t.imageUrl} alt={t.name} className="w-8 h-8 rounded-full mr-3 object-cover"/>
                      ) : (
                          <div className="w-8 h-8 rounded-full mr-3 bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-xs flex-shrink-0">
                              {(t.name || "T").charAt(0).toUpperCase()}
                          </div>
                      )}
                      {t.name}
                  </td>
                  <td className="px-6 py-4">{t.location}</td>
                  <td className="px-6 py-4 flex items-center">
                      <Star className="w-3 h-3 mr-1 text-amber-500 fill-current"/>{t.rating}
                  </td>
                  <td className="px-6 py-4 text-right">
                      {renderActions(() => onEdit(t), () => onDelete(t.id), 'talent', t.name)}
                  </td>
              </tr>
          ))}
      </tbody>
    </table>
    <div className="md:hidden space-y-4 p-4">
        {talent.map((t: TalentProfile) => (
            <div key={t.id} className="bg-black/50 rounded-xl p-4 border border-zinc-800/80 flex flex-col space-y-3">
                <div className="flex items-center space-x-3">
                    {t.imageUrl ? (
                        <img src={t.imageUrl} alt={t.name} className="w-12 h-12 rounded-full border border-zinc-800 flex-shrink-0 object-cover"/>
                    ) : (
                        <div className="w-12 h-12 rounded-full border border-zinc-800 bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-sm flex-shrink-0">
                            {(t.name || "T").charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm truncate">{t.name}</p>
                        <p className="text-xs text-zinc-400 flex items-center mt-0.5 truncate">
                            <MapPin className="w-3 h-3 mr-1 flex-shrink-0 text-zinc-500"/>{t.location}
                        </p>
                    </div>
                </div>
                <div className="border-t border-zinc-900/60 pt-2 flex justify-end space-x-2">
                    <button type="button" onClick={() => onEdit(t)} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold flex items-center transition-all"><Edit className="w-3.5 h-3.5 mr-1 text-zinc-400"/> Edit</button>
                    <button type="button" onClick={() => onDelete(t.id)} className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg text-xs font-semibold flex items-center transition-all"><Trash2 className="w-3.5 h-3.5 mr-1"/> Delete</button>
                </div>
            </div>
        ))}
    </div>
  </div>
);

/**
 * Panel managing global application settings (e.g., featured media, talent directory)
 */
const SiteSettingsPanel = ({ talent, media, settings, onEditTalent, onDeleteTalent, onAddTalent, onSettingsChange, onSaveSettings }: any) => ( 
    <div className="p-4 md:p-6 space-y-8"> 
        <div> 
            <h3 className="text-xl font-bold text-white mb-4">Homepage Configuration</h3> 
            <div className="bg-[#111] p-6 rounded-2xl border border-zinc-800 space-y-4"> 
                <div>
                    <label htmlFor="featuredMediaId" className="block text-sm font-semibold text-zinc-300 mb-2">Featured Hero Video</label> 
                    <select id="featuredMediaId" name="featuredMediaId" value={settings.featuredMediaId || ''} onChange={onSettingsChange} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 transition cursor-pointer"> 
                        <option value="">-- Select a Video --</option> 
                        {media.map((m: MediaItem) => <option key={m.id} value={m.id}>{m.title}</option>)} 
                    </select>
                </div> 
                <div className="flex justify-end pt-2"> 
                    <button type="button" onClick={onSaveSettings} className="bg-yellow-500 hover:bg-yellow-600 text-zinc-900 px-6 py-2.5 rounded-full text-sm font-bold transition-colors">
                        Save Global Settings
                    </button> 
                </div> 
            </div> 
        </div> 
        <div> 
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4"> 
                <h3 className="text-xl font-bold text-white">Talent Directory</h3> 
                <button type="button" onClick={onAddTalent} className="flex items-center bg-yellow-500 hover:bg-yellow-600 text-zinc-900 px-5 py-2 rounded-full text-sm font-bold w-full sm:w-auto justify-center transition-colors">
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Talent
                </button> 
            </div> 
            <div className="overflow-hidden border border-zinc-800 rounded-xl bg-[#111]"> 
                <TalentTable talent={talent} onEdit={onEditTalent} onDelete={onDeleteTalent} /> 
            </div> 
        </div> 
        
        <div className="pt-6 border-t border-zinc-900">
            <CMPSandbox />
        </div>
    </div> 
);

/**
 * Panel displaying real-time system activity logs
 */
const ActivityLogPanel = ({ logs }: { logs: any[] }) => (
  <div className="bg-[#111]/40 border border-zinc-800/80 rounded-2xl overflow-hidden p-4 md:p-6 space-y-4 shadow-2xl">
    <h3 className="text-xl font-bold text-white mb-4">System Activity Log</h3>
    <div className="space-y-3">
      {logs.length === 0 ? (
         <p className="text-zinc-500 text-sm italic">No system activity recorded yet.</p>
      ) : logs.map((log: any) => (
        <div key={log.id} className="flex items-start space-x-4 bg-black/60 p-4 rounded-xl border border-zinc-800/80 transition-colors hover:border-zinc-700">
           {/* Dynamic Icon based on log type */}
           <div className={`p-2.5 rounded-full flex-shrink-0 ${
             log.actionType === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
             log.actionType === 'import' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
             log.actionType === 'rating' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
             'bg-green-500/10 text-green-500 border border-green-500/20'
           }`}>
             {log.actionType === 'error' ? <X className="w-4 h-4"/> : 
              log.actionType === 'import' ? <UploadCloud className="w-4 h-4"/> : 
              log.actionType === 'rating' ? <Star className="w-4 h-4"/> : 
              <ShieldCheck className="w-4 h-4"/>}
           </div>
           
           <div className="flex-1 min-w-0">
             <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 mb-1">
               <p className="font-bold text-white capitalize">{log.actionType}</p>
               <span className="text-xs text-zinc-500 font-mono bg-zinc-900 px-2 py-0.5 rounded">{new Date(log.timestamp).toLocaleString()}</span>
             </div>
             <p className="text-sm text-zinc-300 mt-1 leading-relaxed">{log.details}</p>
             {log.userId && <p className="text-xs text-zinc-500 mt-2 font-mono">Actor ID: {log.userId}</p>}
           </div>
        </div>
      ))}
    </div>
  </div>
);

// --- Form Modals & Inputs ---

const ModalWrapper = ({ title, onClose, children, onSubmit, submitText }: any) => ( 
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"> 
        <div className="bg-[#111] border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"> 
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-black/30"> 
                <h3 className="text-lg font-bold text-white">{title}</h3> 
                <button type="button" aria-label="Close modal" onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full transition-colors">
                    <X className="w-5 h-5 text-zinc-400"/>
                </button> 
            </div> 
            <form onSubmit={onSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar"> 
                {children} 
                <div className="pt-6 mt-6 border-t border-zinc-800/50 flex justify-end space-x-3 sticky bottom-0 bg-[#111]"> 
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full text-zinc-400 font-medium hover:bg-zinc-800 transition-colors">Cancel</button> 
                    <button type="submit" className="px-6 py-2.5 rounded-full bg-yellow-500 text-zinc-900 font-bold hover:bg-yellow-400 transition-colors shadow-lg shadow-yellow-500/20">{submitText || 'Save Changes'}</button> 
                </div> 
            </form> 
        </div> 
    </div> 
);

// Reusable Form Inputs
const FormInput = ({ label, name, value, onChange, placeholder, required = false, type = 'text' }: any) => (
    <div>
        <label htmlFor={name} className="block mb-2 text-sm font-semibold text-zinc-300">{label}</label>
        <input id={name} type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} required={required} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors placeholder:text-zinc-600" />
    </div>
);
const FormTextarea = ({ label, name, value, onChange, placeholder }: any) => (
    <div>
        <label htmlFor={name} className="block mb-2 text-sm font-semibold text-zinc-300">{label}</label>
        <textarea id={name} name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white h-24 focus:outline-none focus:border-yellow-500 transition-colors placeholder:text-zinc-600 resize-none" />
    </div>
);
const FormSelect = ({ label, name, value, onChange, children }: any) => (
    <div>
        <label htmlFor={name} className="block mb-2 text-sm font-semibold text-zinc-300">{label}</label>
        <select id={name} name={name} value={value} onChange={onChange} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors cursor-pointer">{children}</select>
    </div>
);
const FormCheckbox = ({ name, checked, onChange, label }: any) => (
    <label htmlFor={name} className="flex items-center cursor-pointer group">
        <div className="relative flex items-center justify-center w-5 h-5 mr-3">
            <input id={name} type="checkbox" name={name} checked={checked} onChange={onChange} className="peer appearance-none w-5 h-5 border-2 border-zinc-600 rounded bg-black checked:bg-yellow-500 checked:border-yellow-500 focus:outline-none transition-colors cursor-pointer"/>
            {/* Custom Checkmark SVG overlaid on hidden native checkbox */}
            <svg className="absolute w-3 h-3 text-zinc-900 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span className="text-zinc-300 group-hover:text-white transition-colors select-none">{label}</span>
    </label>
);

/**
 * Media Editor / Creator Modal
 */
const MediaFormModal = ({ media, onClose, onSubmit, currentUser }: any) => { 
    const [formData, setFormData] = useState({ 
        title: media?.title || '', 
        description: media?.description || '', 
        thumbnailUrl: media?.thumbnailUrl || '', 
        sourceUrl: media?.sourceUrl || '', 
        mediaType: media?.mediaType || 'video', 
        creatorName: media?.creatorName || currentUser.name, 
        tags: media?.tags?.join(', ') || '', 
        isPremium: media?.isPremium || false, 
        price: media?.price || '' 
    }); 
    const [isAIProcessing, setIsAIProcessing] = useState(false);
    
    const handleChange = (e: any) => { 
        const { name, value, type, checked } = e.target; 
        setFormData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value })); 
    }; 
    
    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        const tagList = formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean); 
        onSubmit({ ...formData, tags: tagList, price: parseFloat(formData.price) || 0 }); 
    }; 
    
    return ( 
        <ModalWrapper title={media ? 'Edit Media' : 'Add New Media'} onClose={onClose} onSubmit={handleSubmit}> 
            <FormInput label="Title" name="title" value={formData.title} onChange={handleChange} placeholder="Media Title" required /> 
            <FormTextarea label="Description" name="description" value={formData.description} onChange={handleChange} placeholder="Detailed description..." /> 
            
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label htmlFor="sourceUrl" className="text-sm font-semibold text-zinc-300">Source URL (Video Link)</label>
                    <button
                        type="button"
                        disabled={isAIProcessing}
                        onClick={async () => {
                            if (!formData.sourceUrl) {
                                alert("Please enter a Source URL (Video Link) first so the AI can scrape it!");
                                return;
                            }
                            setIsAIProcessing(true);
                            try {
                                const result = await api.media.scrapeMetadata(formData.sourceUrl);
                                setFormData(prev => ({
                                    ...prev,
                                    title: result.title || prev.title,
                                    description: result.description || prev.description,
                                    tags: result.tags ? result.tags.join(', ') : prev.tags
                                }));
                            } catch (e) {
                                console.error(e);
                                alert("AI Scraping failed. Make sure the link is valid and try again.");
                            } finally {
                                setIsAIProcessing(false);
                            }
                        }}
                        className="text-xs flex items-center text-yellow-500 hover:text-yellow-400 font-bold transition-colors disabled:opacity-50 cursor-pointer select-none"
                    >
                        <Wand2 className="w-3.5 h-3.5 mr-1" />
                        {isAIProcessing ? 'Scraping with AI...' : 'Auto-Fill with AI'}
                    </button>
                </div>
                <input
                    id="sourceUrl"
                    type="text"
                    name="sourceUrl"
                    value={formData.sourceUrl}
                    onChange={handleChange}
                    placeholder="e.g., https://example.com/video"
                    required
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors placeholder:text-zinc-600"
                />
            </div>

            <FormInput label="Thumbnail URL" name="thumbnailUrl" value={formData.thumbnailUrl} onChange={handleChange} placeholder="e.g., https://example.com/image.jpg" required /> 
            <FormSelect label="Media Type" name="mediaType" value={formData.mediaType} onChange={handleChange}>
                <option value="video">Video File</option>
                <option value="image">Static Image</option>
            </FormSelect> 
            <FormInput label="Creator Name" name="creatorName" value={formData.creatorName} onChange={handleChange} placeholder="Original Creator" required /> 
            <FormInput label="Tags (comma-separated)" name="tags" value={formData.tags} onChange={handleChange} placeholder="e.g., 4k, exclusive, vr" /> 
            <div className="bg-black p-4 rounded-xl border border-zinc-800/50 space-y-4 mt-2"> 
                <FormCheckbox name="isPremium" checked={formData.isPremium} onChange={handleChange} label="Requires Premium Subscription" /> 
                {formData.isPremium && <FormInput label="Price Override (ZAR)" type="number" name="price" value={formData.price} onChange={handleChange} placeholder="Leave 0 for default sub price" />} 
            </div> 
        </ModalWrapper> 
    ); 
};

/**
 * User Editor / Creator Modal
 */
const UserFormModal = ({ user, onClose, onSubmit }: any) => { 
    const [formData, setFormData] = useState({ 
        name: user?.name || '', 
        email: user?.email || '', 
        password: '', 
        role: user?.role || UserRole.CONSUMER, 
        verified: user?.verified || false 
    }); 
    
    const handleChange = (e: any) => { 
        const { name, value, type, checked } = e.target; 
        setFormData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value })); 
    }; 
    
    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        const submissionData = { ...formData }; 
        if (!submissionData.password) { delete (submissionData as any).password; } 
        onSubmit(submissionData); 
    }; 
    
    return ( 
        <ModalWrapper title={user ? 'Edit User Profile' : 'Register New User'} onClose={onClose} onSubmit={handleSubmit}> 
            <FormInput label="Display Name" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" required /> 
            <FormInput label="Email Address" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="john@example.com" required /> 
            <FormInput label="Password" type="password" name="password" value={formData.password} onChange={handleChange} placeholder={user ? "Leave blank to keep unchanged" : "Set secure password"} /> 
            <FormSelect label="System Role" name="role" value={formData.role} onChange={handleChange}>
                {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
            </FormSelect> 
            <div className="bg-black p-4 rounded-xl border border-zinc-800/50 mt-2">
                <FormCheckbox name="verified" checked={formData.verified} onChange={handleChange} label="Verified Creator Account Badge" /> 
            </div>
        </ModalWrapper> 
    ); 
};

/**
 * Talent Profile Editor / Creator Modal
 */
const TalentFormModal = ({ talent, onClose, onSubmit }: any) => { 
    const [formData, setFormData] = useState({ 
        name: talent?.name || '', 
        title: talent?.title || '', 
        location: talent?.location || '', 
        rating: talent?.rating || '4.5', 
        reviewCount: talent?.reviewCount || '0', 
        hourlyRate: talent?.hourlyRate || '1000', 
        imageUrl: talent?.imageUrl || '', 
        verified: talent?.verified || false, 
        online: talent?.online || false, 
        tags: talent?.tags?.join(', ') || '', 
        availability: talent?.availability || 'Available Now' 
    }); 
    
    const handleChange = (e: any) => { 
        const { name, value, type, checked } = e.target; 
        setFormData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value })); 
    }; 
    
    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        const tagList = formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean); 
        onSubmit({ 
            ...formData, 
            tags: tagList, 
            rating: parseFloat(formData.rating), 
            reviewCount: parseInt(formData.reviewCount), 
            hourlyRate: parseInt(formData.hourlyRate) 
        }); 
    }; 
    
    return ( 
        <ModalWrapper title={talent ? 'Edit Talent Profile' : 'Add New Talent Profile'} onClose={onClose} onSubmit={handleSubmit}> 
            <FormInput label="Full Name" name="name" value={formData.name} onChange={handleChange} placeholder="Full Name" required /> 
            <FormInput label="Professional Title" name="title" value={formData.title} onChange={handleChange} placeholder="e.g., Glamour Model & Host" /> 
            <FormInput label="Location" name="location" value={formData.location} onChange={handleChange} placeholder="e.g., Sandton, GP" /> 
            <FormInput label="Profile Image URL" name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://..." /> 
            <div className="grid grid-cols-2 gap-4">
                <FormInput label="Hourly Rate (ZAR)" name="hourlyRate" type="number" value={formData.hourlyRate} onChange={handleChange} placeholder="1500" /> 
                <FormInput label="Avg Rating (0-5)" name="rating" type="number" step="0.1" value={formData.rating} onChange={handleChange} placeholder="4.9" /> 
            </div>
            <FormInput label="Profile Tags (comma-separated)" name="tags" value={formData.tags} onChange={handleChange} placeholder="e.g., VIP, Hosting, Escort" /> 
            <FormSelect label="Current Availability" name="availability" value={formData.availability} onChange={handleChange}>
                <option>Available Now</option>
                <option>This Week</option>
                <option>Booked</option>
            </FormSelect> 
            <div className="bg-black p-4 rounded-xl border border-zinc-800/50 space-y-4 mt-2"> 
                <FormCheckbox name="verified" checked={formData.verified} onChange={handleChange} label="ID/Background Verified" /> 
                <FormCheckbox name="online" checked={formData.online} onChange={handleChange} label="Currently Online (Green Dot)" /> 
            </div>
        </ModalWrapper> 
    ); 
};

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
        <InfoRow label="Gemini AI Integration" value={status.gemini?.enabled ? `Enabled (${status.gemini.model})` : "Disabled"} />
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
