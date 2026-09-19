import React, { useState, useEffect, useRef } from 'react';
import { User, MediaItem, UserRole, TalentProfile } from '../types';
import { ShieldCheck, Grid, Edit3, Camera, CheckCircle, AlertCircle, Lock, Crown, Plus, Briefcase, DollarSign, MapPin, Tag, Trash, Sparkles, X } from 'lucide-react';
import MediaGrid from '../components/MediaGrid';
import { api } from '../services/api';
import { session } from '../services/session';
import UploadMedia from './UploadMedia';
import PaymentModal from '../components/PaymentModal';

interface UserProfileProps {
  userId: string;
  currentUser: User;
  onMediaClick: (id: string) => void;
  onUserUpdate: (user: User) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ userId, currentUser, onMediaClick, onUserUpdate }) => {
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'videos' | 'services' | 'about' | 'settings'>('videos');
  const [userVideos, setUserVideos] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Custom User Bio
  const [bio, setBio] = useState('');

  // Talent Profile & Onboarding states
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const [onboardingTitle, setOnboardingTitle] = useState('Exclusive Creator');
  const [onboardingLocation, setOnboardingLocation] = useState('Cape Town, South Africa');
  const [onboardingHourlyRate, setOnboardingHourlyRate] = useState('250');
  const [onboardingAvailability, setOnboardingAvailability] = useState<'Available Now' | 'This Week' | 'Booked'>('Available Now');
  const [onboardingTags, setOnboardingTags] = useState('Exclusive, Sensory, Custom Requests');

  // Virtual Services / Products Modal states
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('150');
  const [newProductImage, setNewProductImage] = useState('');
  
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string; price: number } | null>(null);

  // Form State for Credentials (only if own profile)
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [credentialError, setCredentialError] = useState('');
  const [credentialSuccess, setCredentialSuccess] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const generateBlankImage = (text: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400"><rect width="1200" height="400" fill="#27272a" /><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="32" font-family="sans-serif" fill="#71717a">${text}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  const [coverImage, setCoverImage] = useState(generateBlankImage('Cover Image Hidden'));

  const isOwnProfile = currentUser.id === userId;

  useEffect(() => {
    const fetchProfile = async () => {
        const user = await api.users.getById(userId);
        if (user) {
            setProfileUser(user);
            setUsername(user.name);
            setBio(user.bio || '');
            if (user.wallpaperUrl) {
                setCoverImage(user.wallpaperUrl);
            }
            
            const allMedia = await api.media.getAll();
            const myMedia = allMedia.filter(m => m.userId === userId);
            setUserVideos(myMedia);

            // Fetch Talent Profile if they have a creator/pro role
            if (user.role === 'CREATOR' || user.role === 'PROFESSIONAL') {
                try {
                    const allTalent = await api.talent.getAll();
                    const myTalent = allTalent.find(t => t.userId === userId);
                    if (myTalent) {
                        setTalentProfile(myTalent);
                    }
                } catch (err) {
                    console.error("Failed to load talent profile", err);
                }
            }
        }
    };
    fetchProfile();
  }, [userId, currentUser.id]);

  const refreshMedia = async () => {
    const allMedia = await api.media.getAll();
    const myMedia = allMedia.filter(m => m.userId === userId);
    setUserVideos(myMedia);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, imageType: 'avatar' | 'cover') => {
      if (!isOwnProfile) return;
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          let newUrl = '';
          try {
            newUrl = await api.media.uploadFile(file);
          } catch (uploadErr) {
            console.error("Upload failed", uploadErr);
            newUrl = URL.createObjectURL(file); // Fallback if server is not handling it
          }
          if (imageType === 'avatar') {
              try {
                  const updatedUser = await api.auth.updateProfile(userId, { avatarUrl: newUrl });
                  session.updateUser(updatedUser);
                  onUserUpdate(updatedUser);
                  setProfileUser(updatedUser);
              } catch (e) {
                  console.error(e);
              }
          } else {
              try {
                  const updatedUser = await api.auth.updateProfile(userId, { wallpaperUrl: newUrl });
                  session.updateUser(updatedUser);
                  onUserUpdate(updatedUser);
                  setProfileUser(updatedUser);
                  setCoverImage(newUrl);
              } catch (e) {
                  console.error(e);
              }
          }
      }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnProfile) return;
    
    setCredentialError('');
    setCredentialSuccess('');

    if (newPassword && newPassword !== confirmPassword) {
        setCredentialError('Passwords do not match.');
        return;
    }

    const updates: Partial<User> = { name: username, bio };
    if (newPassword) {
        updates.password = newPassword;
    }

    try {
        const updatedUser = await api.auth.updateProfile(userId, updates);
        session.updateUser(updatedUser);
        onUserUpdate(updatedUser);
        setProfileUser(updatedUser);
        setCredentialSuccess('Credentials updated successfully!');
        setTimeout(() => setCredentialSuccess(''), 3000);
        setNewPassword('');
        setConfirmPassword('');
    } catch (e) {
        setCredentialError('Failed to update credentials.');
    }
  };

  const handleSubscribeSuccess = async () => {
      try {
          const res = await api.users.subscribe(currentUser.id, userId);
          const updatedUser = (res as any)?.user || res;
          session.updateUser(updatedUser);
          onUserUpdate(updatedUser);
          setShowPaymentModal(false);
      } catch (e) {
          alert("Subscription failed");
      }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newProfile = await api.talent.create({
        userId: currentUser.id,
        name: currentUser.name,
        title: onboardingTitle,
        location: onboardingLocation,
        rating: 5,
        reviewCount: 0,
        hourlyRate: Number(onboardingHourlyRate) || 0,
        imageUrl: currentUser.avatarUrl || '',
        verified: false,
        online: true,
        chatOnline: true,
        tags: onboardingTags.split(',').map(t => t.trim()).filter(Boolean),
        availability: onboardingAvailability,
        products: []
      });
      setTalentProfile(newProfile);
      setShowOnboarding(false);
    } catch (err) {
      console.error("Failed to create talent profile", err);
      alert("Failed to create talent profile");
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!talentProfile) return;
    
    const newProduct = {
      id: Math.random().toString(36).substring(2, 9),
      name: newProductName,
      description: newProductDesc,
      price: Number(newProductPrice) || 0,
      imageUrl: newProductImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
      contactUrl: '#'
    };

    const updatedProducts = [...(talentProfile.products || []), newProduct];
    try {
      const updated = await api.talent.update(talentProfile.id, { products: updatedProducts });
      setTalentProfile(updated);
      setShowAddProductModal(false);
      setNewProductName('');
      setNewProductDesc('');
      setNewProductPrice('150');
      setNewProductImage('');
    } catch (err) {
      console.error("Failed to add product", err);
      alert("Failed to add product");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!talentProfile) return;
    if (!confirm("Are you sure you want to delete this service?")) return;

    const updatedProducts = (talentProfile.products || []).filter(p => p.id !== productId);
    try {
      const updated = await api.talent.update(talentProfile.id, { products: updatedProducts });
      setTalentProfile(updated);
    } catch (err) {
      console.error("Failed to delete product", err);
      alert("Failed to delete product");
    }
  };

  if (!profileUser) {
    return <div className="text-center py-20 text-zinc-500">Loading user profile...</div>;
  }

  const isContentCreator = true; // Allow all users to upload content
  
  // Subscription & Visibility Logic
  const isSubscribed = currentUser.subscriptions?.includes(userId);
  const showAllContent = isOwnProfile || isSubscribed;
  
  // Logic: Show first 3 items, then lock the rest if not subscribed
  const VISIBLE_LIMIT = 3;
  const visibleContent = showAllContent ? userVideos : userVideos.slice(0, VISIBLE_LIMIT);
  const hiddenContent = showAllContent ? [] : userVideos.slice(VISIBLE_LIMIT);

  return (
    <div className="-mt-6">
      {isOwnProfile && (
        <>
          <input type="file" ref={avatarInputRef} onChange={(e) => handleImageChange(e, 'avatar')} className="hidden" accept="image/*" />
          <input type="file" ref={coverInputRef} onChange={(e) => handleImageChange(e, 'cover')} className="hidden" accept="image/*" />
        </>
      )}
      
      {/* Payment Modal */}
      {showPaymentModal && (
          <PaymentModal 
            creatorName={profileUser.name}
            price={150}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={handleSubscribeSuccess}
          />
      )}
      
      {/* Cover Image */}
      <div className="h-48 sm:h-64 md:h-80 w-full relative bg-zinc-800 overflow-hidden">
        {coverImage ? (
          <img src={coverImage} alt="Cover" className="w-full h-full object-cover opacity-60"/>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div>
        {isOwnProfile && (
          <button type="button" onClick={() => coverInputRef.current?.click()} aria-label="Change cover image" className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/70 transition-all border border-white/10 z-20">
            <Camera className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-start md:items-end -mt-16 md:-mt-20 mb-8 pb-8 border-b border-zinc-800">
          <div className="relative group flex-shrink-0">
            <div className="w-28 h-28 md:w-40 md:h-40 rounded-full border-4 border-zinc-950 bg-[#111] overflow-hidden relative flex items-center justify-center">
              {profileUser.avatarUrl ? (
                <img src={profileUser.avatarUrl} alt={profileUser.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-3xl md:text-5xl">
                  {(profileUser.name || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {isOwnProfile && (
              <button type="button" aria-label="Edit profile picture" onClick={() => avatarInputRef.current?.click()} className="absolute bottom-2 right-2 bg-yellow-500 text-white p-2 rounded-full shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <Edit3 className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="mt-4 md:mt-0 md:ml-6 flex-1 min-w-0 w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center">
                  <span className="truncate">{profileUser.name}</span>
                  {profileUser.verified && <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 ml-2 text-green-500 flex-shrink-0" />}
                </h1>
                <p className="text-zinc-400 mt-1 truncate text-sm sm:text-base">@{profileUser.name.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, '')} • {profileUser.role === 'CREATOR' ? 'Verified Creator' : (profileUser.role === 'ADMIN' ? 'Administrator' : 'Member')}</p>
              </div>
              
              {!isOwnProfile && isContentCreator && !isSubscribed && (
                <div className="mt-4 md:mt-0 flex gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => setShowPaymentModal(true)}
                    className="bg-yellow-500 hover:bg-yellow-400 text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-yellow-500/30 flex-1 md:flex-initial flex items-center justify-center text-sm"
                  >
                    <Crown className="w-4 h-4 mr-2" /> Subscribe (R150)
                  </button>
                  <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2.5 rounded-full font-bold border border-zinc-700 flex-1 md:flex-initial text-sm">
                    Message
                  </button>
                </div>
              )}
               {!isOwnProfile && isContentCreator && isSubscribed && (
                  <div className="mt-4 md:mt-0 flex gap-3 w-full md:w-auto">
                    <button className="bg-[#111] border border-zinc-700 text-zinc-300 px-6 py-2.5 rounded-full font-bold flex-1 md:flex-initial flex items-center justify-center text-sm cursor-default">
                        <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Subscribed
                    </button>
                  </div>
              )}
            </div>

            {isContentCreator && (
              <div className="flex flex-wrap items-center gap-x-6 sm:gap-x-8 gap-y-4 mt-6">
                <div>
                  <span className="block text-lg sm:text-xl font-bold text-white">12.5K</span>
                  <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider">Subscribers</span>
                </div>
                <div>
                  <span className="block text-lg sm:text-xl font-bold text-white">450K</span>
                  <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider">Total Views</span>
                </div>
                <div>
                  <span className="block text-lg sm:text-xl font-bold text-white">{userVideos.length}</span>
                  <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider">Videos</span>
                </div>
              </div>
            )}

            {isOwnProfile && talentProfile && (
              <div className="flex items-center space-x-3 bg-[#111] border border-zinc-800 rounded-xl px-4 py-2 mt-4 max-w-xs">
                <span className="text-xs text-zinc-400 font-semibold">Direct Chats:</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={talentProfile.chatOnline} 
                    onChange={async () => {
                      const updated = await api.talent.update(talentProfile.id, { chatOnline: !talentProfile.chatOnline });
                      setTalentProfile(updated);
                    }} 
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                </label>
                <span className={`text-xs font-bold ${talentProfile.chatOnline ? 'text-green-500' : 'text-zinc-500'}`}>
                  {talentProfile.chatOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            )}

            {isOwnProfile && !talentProfile && (profileUser.role === 'CREATOR' || profileUser.role === 'PROFESSIONAL') && (
              <button 
                onClick={() => setShowOnboarding(true)}
                className="mt-4 flex items-center bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-yellow-500/20 active:scale-95"
              >
                <Sparkles className="w-4 h-4 mr-2" /> Set Up Creator Profile
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 bg-[#111]/50 p-1 rounded-xl w-full sm:w-fit border border-zinc-800 overflow-x-auto no-scrollbar">
          <button type="button" onClick={() => { setActiveTab('videos'); setIsUploading(false); }} className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${ activeTab === 'videos' && !isUploading ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white' }`}>Content</button>
          {(profileUser.role === 'CREATOR' || profileUser.role === 'PROFESSIONAL') && (
            <button type="button" onClick={() => { setActiveTab('services'); setIsUploading(false); }} className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${ activeTab === 'services' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white' }`}>Services</button>
          )}
          <button type="button" onClick={() => { setActiveTab('about'); setIsUploading(false); }} className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${ activeTab === 'about' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white' }`}>About</button>
          {isOwnProfile && (
            <button type="button" onClick={() => { setActiveTab('settings'); setIsUploading(false); }} className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${ activeTab === 'settings' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white' }`}>Settings</button>
          )}
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          {activeTab === 'videos' && (
             isUploading ? (
               <UploadMedia 
                 user={currentUser} 
                 onCancel={() => setIsUploading(false)} 
                 onUploadComplete={() => {
                   setIsUploading(false);
                   refreshMedia();
                 }} 
               />
             ) : (
               isContentCreator ? (
                  <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <h2 className="text-lg sm:text-xl font-bold text-white">{isOwnProfile ? 'Latest Content' : profileUser.name + "'s Feed"}</h2>
                         {isOwnProfile && (
                           <button 
                             onClick={() => setIsUploading(true)}
                             className="flex items-center bg-white text-black px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold hover:bg-zinc-200 transition-colors"
                           >
                             <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                             Upload
                           </button>
                         )}
                      </div>

                      {userVideos.length > 0 ? (
                          <div className="space-y-8">
                              <MediaGrid items={visibleContent} onItemClick={onMediaClick} showPremiumBadge={true} />
                              
                              {/* Locked Content Blur Overlay */}
                              {hiddenContent.length > 0 && (
                                  <div className="relative pb-12">
                                      <div className="filter blur-xl grayscale opacity-50 pointer-events-none scale-95 transition-all select-none">
                                          <MediaGrid items={hiddenContent} onItemClick={() => {}} showPremiumBadge={true} />
                                      </div>
                                      <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-center p-4 rounded-3xl border border-yellow-500/20 shadow-2xl">
                                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4 sm:mb-6 border border-yellow-500/30 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
                                              <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400" />
                                          </div>
                                          <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Subscribe to See More</h3>
                                          <p className="text-zinc-400 mt-3 max-w-sm text-base sm:text-lg leading-relaxed">
                                              Get instant, uncensored access to all {hiddenContent.length} exclusive videos and images by {profileUser.name}.
                                          </p>
                                          <button 
                                            onClick={() => setShowPaymentModal(true)}
                                            className="mt-8 bg-yellow-500 hover:bg-yellow-400 text-white px-8 sm:px-10 py-3 sm:py-4 rounded-full font-bold flex items-center shadow-lg shadow-yellow-500/30 transition-all active:scale-95 text-sm sm:text-base"
                                          >
                                              <Crown className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                                              Subscribe for R150 / Month
                                          </button>
                                          <p className="mt-4 text-xs text-zinc-500 font-medium">Auto-renewing. Cancel anytime.</p>
                                      </div>
                                  </div>
                              )}
                          </div>
                      ) : (
                        <div className="text-center py-20 bg-[#111]/50 rounded-3xl border-2 border-dashed border-zinc-800">
                          <Camera className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-white">No content available</h3>
                          {isOwnProfile ? (
                            <>
                              <p className="text-zinc-400 mt-2 mb-8">Share your first exclusive video or photo with your fans.</p>
                              <button 
                                onClick={() => setIsUploading(true)}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg shadow-yellow-500/20"
                              >
                                Get Started
                              </button>
                            </>
                          ) : (
                            <p className="text-zinc-400 mt-2">Check back soon for new content from this creator.</p>
                          )}
                        </div>
                      )}
                  </div>
               ) : (
                  <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-3xl bg-[#111]/30">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                      <Grid className="w-8 h-8 text-zinc-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No Content to Display</h3>
                    <p className="text-zinc-400 max-w-md text-center">This user has not uploaded any content yet.</p>
                  </div>
               )
             )
          )}
          
          {activeTab === 'services' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Virtual Services & Offerings</h2>
                  <p className="text-zinc-500 text-sm mt-1">Book personalized experiences, custom content sets, or video calls.</p>
                </div>
                {isOwnProfile && talentProfile && (
                  <button 
                    onClick={() => setShowAddProductModal(true)}
                    className="flex items-center bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 shadow-lg shadow-yellow-500/20"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Service
                  </button>
                )}
              </div>

              {talentProfile && (talentProfile.products || []).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(talentProfile.products || []).map((product) => (
                    <div key={product.id} className="bg-[#111] rounded-2xl border border-zinc-800/80 p-5 hover:border-zinc-700 transition-all group flex flex-col justify-between">
                      <div>
                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-zinc-900 mb-4 relative">
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                          <div className="absolute top-3 right-3 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold">
                            R{product.price}
                          </div>
                        </div>
                        <h3 className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors">{product.name}</h3>
                        <p className="text-zinc-400 text-sm mt-2 line-clamp-3 leading-relaxed">{product.description}</p>
                      </div>
                      
                      <div className="mt-6 flex items-center justify-between gap-3">
                        {isOwnProfile ? (
                          <button 
                            onClick={() => handleDeleteProduct(product.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 p-2.5 rounded-xl transition-colors text-sm font-semibold flex-1 flex items-center justify-center"
                          >
                            <Trash className="w-4 h-4 mr-2" /> Delete
                          </button>
                        ) : (
                          <button 
                            onClick={() => {
                              setSelectedProduct({ id: product.id, name: product.name, price: product.price });
                            }}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2.5 px-6 rounded-xl transition-all w-full text-sm flex items-center justify-center active:scale-95"
                          >
                            <Crown className="w-4 h-4 mr-2" /> Book Service
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-[#111]/30 rounded-3xl border border-dashed border-zinc-800">
                  <Briefcase className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white">No services listed yet</h3>
                  {isOwnProfile ? (
                    <>
                      <p className="text-zinc-500 mt-2 mb-6 max-w-sm mx-auto">Create custom listings for physical merch, video calls, custom photo/video sets, and more!</p>
                      <button 
                        onClick={() => {
                          if (!talentProfile) {
                            setShowOnboarding(true);
                          } else {
                            setShowAddProductModal(true);
                          }
                        }}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black px-8 py-3 rounded-full font-bold shadow-lg shadow-yellow-500/10"
                      >
                        Create Your First Service
                      </button>
                    </>
                  ) : (
                    <p className="text-zinc-500 mt-2">Check back later for personalized services from this creator.</p>
                  )}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'about' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-[#111] rounded-2xl border border-zinc-800 p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">About {profileUser.name}</h3>
                  <p className="text-zinc-400 leading-relaxed text-sm sm:text-base whitespace-pre-line">
                    {profileUser.bio || "This user has not written a bio yet. Look forward to more exciting updates soon!"}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                  <div className="bg-black/50 p-4 rounded-xl border border-zinc-800">
                    <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Joined Platform</p>
                    <p className="text-white font-medium mt-1">October 2025</p>
                  </div>
                  <div className="bg-black/50 p-4 rounded-xl border border-zinc-800">
                    <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Verified Creator</p>
                    <p className="text-white font-medium mt-1">{profileUser.verified ? 'Yes' : 'Elysian Core Partner'}</p>
                  </div>
                </div>
              </div>

              {talentProfile && (
                <div className="bg-[#111] rounded-2xl border border-zinc-800 p-6 space-y-6 h-fit">
                  <h3 className="text-lg font-bold text-white pb-3 border-b border-zinc-800/80 flex items-center">
                    <Briefcase className="w-4 h-4 mr-2 text-yellow-500" /> Creator Details
                  </h3>
                  
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Location:</span>
                      <span className="text-zinc-200 font-medium flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1 text-zinc-400" /> {talentProfile.location || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Hourly Rate:</span>
                      <span className="text-zinc-200 font-semibold text-yellow-500">
                        R{talentProfile.hourlyRate}/hr
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Availability:</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        talentProfile.availability === 'Available Now' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        talentProfile.availability === 'This Week' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {talentProfile.availability}
                      </span>
                    </div>
                  </div>

                  {talentProfile.tags && talentProfile.tags.length > 0 && (
                    <div className="space-y-2 pt-4 border-t border-zinc-800/50">
                      <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider block">Specialties</span>
                      <div className="flex flex-wrap gap-1.5">
                        {talentProfile.tags.map((tag, idx) => (
                          <span key={idx} className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs px-2.5 py-1 rounded-lg">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isOwnProfile && activeTab === 'settings' && (
            <div className="bg-[#111] rounded-2xl border border-zinc-800 p-6 sm:p-8 max-w-2xl space-y-10">
               {talentProfile && (
                 <div>
                   <h3 className="text-xl font-bold text-white mb-6">Creator Profile Settings</h3>
                   <form onSubmit={async (e) => {
                     e.preventDefault();
                     try {
                       const updated = await api.talent.update(talentProfile.id, {
                         title: onboardingTitle,
                         location: onboardingLocation,
                         hourlyRate: Number(onboardingHourlyRate) || 0,
                         availability: onboardingAvailability,
                         tags: onboardingTags.split(',').map(t => t.trim()).filter(Boolean),
                       });
                       setTalentProfile(updated);
                       alert("Creator settings saved successfully!");
                     } catch (err) {
                       console.error("Failed to update creator profile", err);
                       alert("Failed to update creator profile");
                     }
                   }} className="space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div>
                         <label className="text-sm text-zinc-400">Professional Title</label>
                         <input type="text" value={onboardingTitle} onChange={(e) => setOnboardingTitle(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-2 text-white focus:ring-1 focus:ring-yellow-500 text-sm"/>
                       </div>
                       <div>
                         <label className="text-sm text-zinc-400">Location</label>
                         <input type="text" value={onboardingLocation} onChange={(e) => setOnboardingLocation(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-2 text-white focus:ring-1 focus:ring-yellow-500 text-sm"/>
                       </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div>
                         <label className="text-sm text-zinc-400">Hourly Rate (ZAR)</label>
                         <input type="number" value={onboardingHourlyRate} onChange={(e) => setOnboardingHourlyRate(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-2 text-white focus:ring-1 focus:ring-yellow-500 text-sm"/>
                       </div>
                       <div>
                         <label className="text-sm text-zinc-400">Availability Status</label>
                         <select value={onboardingAvailability} onChange={(e) => setOnboardingAvailability(e.target.value as any)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-2 text-white focus:ring-1 focus:ring-yellow-500 text-sm">
                           <option value="Available Now">Available Now</option>
                           <option value="This Week">This Week</option>
                           <option value="Booked">Booked</option>
                         </select>
                       </div>
                     </div>

                     <div>
                       <label className="text-sm text-zinc-400">Specialty Tags (Comma separated)</label>
                       <input type="text" value={onboardingTags} onChange={(e) => setOnboardingTags(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-2 text-white focus:ring-1 focus:ring-yellow-500 text-sm" placeholder="e.g. Custom Calls, Cosplay, Exclusive Content"/>
                     </div>

                     <div className="flex justify-end pt-2">
                       <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2.5 rounded-xl font-bold text-sm">Save Creator Details</button>
                     </div>
                   </form>
                   <div className="border-b border-zinc-800/80 my-8"></div>
                 </div>
               )}

               <div>
                  <h3 className="text-xl font-bold text-white mb-6">Account Settings</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
                      <div>
                        <p className="text-white font-medium">Email Notifications</p>
                        <p className="text-sm text-zinc-500">Receive updates about your content and fans</p>
                      </div>
                      <div className="w-11 h-6 bg-yellow-500 rounded-full relative cursor-pointer">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>
               </div>
               
               <div>
                 <h3 className="text-xl font-bold text-white mb-6">Credentials</h3>
                 <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm text-zinc-400">Display Name</label>
                      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-2 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all text-sm"/>
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400">Short Bio</label>
                      <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-2 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all resize-none text-sm" placeholder="Write a short bio about yourself..."/>
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400">New Password</label>
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-2 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all text-sm" placeholder="Leave blank to keep current password"/>
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400">Confirm New Password</label>
                      <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-2 text-white focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500 focus:outline-none transition-all text-sm"/>
                    </div>
                    {credentialError && <p className="text-sm text-yellow-400 flex items-center"><AlertCircle className="w-4 h-4 mr-2"/>{credentialError}</p>}
                    {credentialSuccess && <p className="text-sm text-green-500 flex items-center"><CheckCircle className="w-4 h-4 mr-2"/>{credentialSuccess}</p>}
                    <div className="flex justify-end pt-2">
                      <button type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2.5 rounded-xl font-bold text-sm w-full sm:w-auto">Save Account Changes</button>
                    </div>
                 </form>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Onboarding Wizard Modal --- */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#111] border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button 
              onClick={() => setShowOnboarding(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3 mb-6">
              <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
              <h2 className="text-2xl font-bold text-white">Create Creator Profile</h2>
            </div>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">Establish your professional listing to unlock paywalled virtual services, live bookings, and direct status toggles.</p>
            
            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Professional Title</label>
                <input type="text" value={onboardingTitle} onChange={(e) => setOnboardingTitle(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-1.5 text-white focus:ring-1 focus:ring-yellow-500 text-sm" placeholder="e.g. Premium Model, Fetish Entertainer" required />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Location</label>
                <input type="text" value={onboardingLocation} onChange={(e) => setOnboardingLocation(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-1.5 text-white focus:ring-1 focus:ring-yellow-500 text-sm" placeholder="e.g. Cape Town, ZA" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Hourly Rate (ZAR)</label>
                  <input type="number" value={onboardingHourlyRate} onChange={(e) => setOnboardingHourlyRate(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-1.5 text-white focus:ring-1 focus:ring-yellow-500 text-sm" placeholder="250" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Availability</label>
                  <select value={onboardingAvailability} onChange={(e) => setOnboardingAvailability(e.target.value as any)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-1.5 text-white focus:ring-1 focus:ring-yellow-500 text-sm">
                    <option value="Available Now">Available Now</option>
                    <option value="This Week">This Week</option>
                    <option value="Booked">Booked</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Specialty Tags (Comma separated)</label>
                <input type="text" value={onboardingTags} onChange={(e) => setOnboardingTags(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-1.5 text-white focus:ring-1 focus:ring-yellow-500 text-sm" placeholder="e.g. Sensory, Customs, Video Call" required />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowOnboarding(false)} className="flex-1 border border-zinc-800 hover:border-zinc-700 text-zinc-400 py-3 rounded-xl font-bold text-sm">Cancel</button>
                <button type="submit" className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black py-3 rounded-xl font-bold text-sm shadow-lg shadow-yellow-500/10">Publish Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Add Service Modal --- */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#111] border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button 
              onClick={() => setShowAddProductModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3 mb-6">
              <Briefcase className="w-6 h-6 text-yellow-500" />
              <h2 className="text-2xl font-bold text-white">Add Virtual Service</h2>
            </div>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">Offer virtual services, merchandise, video calls, or custom digital content sets to your fan base.</p>
            
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Service Name</label>
                <input type="text" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-1.5 text-white focus:ring-1 focus:ring-yellow-500 text-sm" placeholder="e.g. 1-on-1 Video Chat (15 mins)" required />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Description</label>
                <textarea value={newProductDesc} onChange={(e) => setNewProductDesc(e.target.value)} rows={3} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-1.5 text-white focus:ring-1 focus:ring-yellow-500 text-sm resize-none" placeholder="Provide details on what you will provide and how the client will receive it..." required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Price (ZAR)</label>
                  <input type="number" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-1.5 text-white focus:ring-1 focus:ring-yellow-500 text-sm" placeholder="150" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cover Image URL (Optional)</label>
                  <input type="url" value={newProductImage} onChange={(e) => setNewProductImage(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 mt-1.5 text-white focus:ring-1 focus:ring-yellow-500 text-sm" placeholder="https://example.com/image.jpg" />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddProductModal(false)} className="flex-1 border border-zinc-800 hover:border-zinc-700 text-zinc-400 py-3 rounded-xl font-bold text-sm">Cancel</button>
                <button type="submit" className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black py-3 rounded-xl font-bold text-sm shadow-lg shadow-yellow-500/10">Add Offering</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Purchase / Booking Checkout Modal --- */}
      {selectedProduct && (
        <PaymentModal 
          creatorName={`${profileUser.name} - ${selectedProduct.name}`}
          price={selectedProduct.price}
          onClose={() => setSelectedProduct(null)}
          onSuccess={async () => {
            alert(`Purchase successful! You have purchased: ${selectedProduct.name}. A message request has been sent to ${profileUser.name}.`);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
};

export default UserProfile;