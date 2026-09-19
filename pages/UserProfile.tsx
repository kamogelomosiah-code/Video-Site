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

  const [bio, setBio] = useState('');
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [onboardingTitle, setOnboardingTitle] = useState('Exclusive Creator');
  const [onboardingLocation, setOnboardingLocation] = useState('Cape Town, South Africa');
  const [onboardingHourlyRate, setOnboardingHourlyRate] = useState('250');
  const [onboardingAvailability, setOnboardingAvailability] = useState<'Available Now' | 'This Week' | 'Booked'>('Available Now');
  const [onboardingTags, setOnboardingTags] = useState('Exclusive, Sensory, Custom Requests');

  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('150');
  const [newProductImage, setNewProductImage] = useState('');

  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string; price: number } | null>(null);

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

        if (user.role === 'CREATOR' || user.role === 'PROFESSIONAL') {
          try {
            const allTalent = await api.talent.getAll();
            const myTalent = allTalent.find(t => t.userId === userId);
            if (myTalent) {
              setTalentProfile(myTalent);
            }
          } catch (err) {
            console.error('Failed to load talent profile', err);
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
        console.error('Upload failed', uploadErr);
        newUrl = URL.createObjectURL(file);
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
      const refreshedCreator = await api.users.getById(userId);
      setProfileUser(refreshedCreator);
      setShowPaymentModal(false);
    } catch (e) {
      alert('Subscription failed');
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
      console.error('Failed to create talent profile', err);
      alert('Failed to create talent profile');
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
      console.error('Failed to add product', err);
      alert('Failed to add product');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!talentProfile) return;
    if (!confirm('Are you sure you want to delete this service?')) return;

    const updatedProducts = (talentProfile.products || []).filter(p => p.id !== productId);
    try {
      const updated = await api.talent.update(talentProfile.id, { products: updatedProducts });
      setTalentProfile(updated);
    } catch (err) {
      console.error('Failed to delete product', err);
      alert('Failed to delete product');
    }
  };

  if (!profileUser) {
    return <div className="text-center py-20 text-zinc-500">Loading user profile...</div>;
  }

  const isContentCreator = true;
  const isSubscribed = currentUser.subscriptions?.includes(userId);
  const showAllContent = isOwnProfile || isSubscribed;
  const VISIBLE_LIMIT = 3;
  const visibleContent = showAllContent ? userVideos : userVideos.slice(0, VISIBLE_LIMIT);
  const hiddenContent = showAllContent ? [] : userVideos.slice(VISIBLE_LIMIT);

  const subscriberCount = profileUser.subscriberCount ?? 0;
  const totalViews = profileUser.totalViews ?? 0;

  return (
    <div className="-mt-6">
      {isOwnProfile && (
        <>
          <input type="file" ref={avatarInputRef} onChange={(e) => handleImageChange(e, 'avatar')} className="hidden" accept="image/*" />
          <input type="file" ref={coverInputRef} onChange={(e) => handleImageChange(e, 'cover')} className="hidden" accept="image/*" />
        </>
      )}

      {showPaymentModal && (
        <PaymentModal
          creatorName={profileUser.name}
          price={150}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handleSubscribeSuccess}
        />
      )}

      <div className="h-48 sm:h-64 md:h-80 w-full relative bg-zinc-800 overflow-hidden">
        {coverImage ? (
          <img src={coverImage} alt="Cover" className="w-full h-full object-cover opacity-60" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div>
        {isOwnProfile && (
          <button type="button" onClick={() => coverInputRef.current?.click()} aria-label="Change cover image" className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md p-2 rounded-full text-white hover:bg-black/70">
            <Camera className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="flex flex-col md:flex-row items-start md:items-end -mt-16 md:-mt-20 mb-8 pb-8 border-b border-zinc-800">
          <div className="relative group flex-shrink-0">
            <div className="w-28 h-28 md:w-40 md:h-40 rounded-full border-4 border-zinc-950 bg-[#111] overflow-hidden relative flex items-center justify-center">
              {profileUser.avatarUrl ? (
                <img src={profileUser.avatarUrl} alt={profileUser.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-zinc-800 text-yellow-500 font-bold flex items-center justify-center text-3xl md:text-5xl">
                  {(profileUser.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {isOwnProfile && (
              <button type="button" aria-label="Edit profile picture" onClick={() => avatarInputRef.current?.click()} className="absolute bottom-2 right-2 bg-yellow-500 text-white p-2 rounded-full">
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
                <p className="text-zinc-400 mt-1 truncate text-sm sm:text-base">@{profileUser.name.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, '')} • {profileUser.role === 'CREATOR' || profileUser.role === 'PROFESSIONAL' ? 'Creator' : 'Member'}</p>
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
                  <span className="block text-lg sm:text-xl font-bold text-white">{subscriberCount}</span>
                  <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider">Subscribers</span>
                </div>
                <div>
                  <span className="block text-lg sm:text-xl font-bold text-white">{totalViews}</span>
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
                className="mt-4 flex items-center bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-yellow-500/20 active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 mr-2" /> Set Up Creator Profile
              </button>
            )}
          </div>
        </div>

        <div className="flex space-x-1 mb-8 bg-[#111]/50 p-1 rounded-xl w-full sm:w-fit border border-zinc-800 overflow-x-auto no-scrollbar">
          <button type="button" onClick={() => { setActiveTab('videos'); setIsUploading(false); }} className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'videos' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>
            Videos
          </button>
          {(profileUser.role === 'CREATOR' || profileUser.role === 'PROFESSIONAL') && (
            <button type="button" onClick={() => { setActiveTab('services'); setIsUploading(false); }} className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'services' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>
              Services
            </button>
          )}
          <button type="button" onClick={() => { setActiveTab('about'); setIsUploading(false); }} className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'about' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>
            About
          </button>
          {isOwnProfile && (
            <button type="button" onClick={() => { setActiveTab('settings'); setIsUploading(false); }} className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>
              Settings
            </button>
          )}
        </div>

        <div className="min-h-[400px]">
          {activeTab === 'videos' && (
            isUploading ? (
              <UploadMedia user={currentUser} onCancel={() => setIsUploading(false)} onUploadComplete={() => { setIsUploading(false); refreshMedia(); }} />
            ) : (
              isContentCreator ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg sm:text-xl font-bold text-white">{isOwnProfile ? 'Latest Content' : profileUser.name + "'s Feed"}</h2>
                    {isOwnProfile && (
                      <button onClick={() => setIsUploading(true)} className="flex items-center bg-white text-black px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold hover:bg-zinc-200 transition-colors">
                        <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                        Upload
                      </button>
                    )}
                  </div>

                  {userVideos.length > 0 ? (
                    <div className="space-y-8">
                      <MediaGrid items={visibleContent} onItemClick={onMediaClick} showPremiumBadge={true} />

                      {hiddenContent.length > 0 && (
                        <div className="relative pb-12">
                          <div className="filter blur-xl grayscale opacity-50 pointer-events-none scale-95 transition-all select-none">
                            <MediaGrid items={hiddenContent} onItemClick={() => {}} showPremiumBadge={true} />
                          </div>
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-center p-4 rounded-3xl border border-yellow-500/20">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4 sm:mb-6 border border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                              <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400" />
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Subscribe to See More</h3>
                            <p className="text-zinc-400 mt-3 max-w-sm text-base sm:text-lg leading-relaxed">
                              Get instant, uncensored access to all {hiddenContent.length} exclusive videos and images by {profileUser.name}.
                            </p>
                            <button onClick={() => setShowPaymentModal(true)} className="mt-8 bg-yellow-500 hover:bg-yellow-400 text-white px-8 sm:px-10 py-3 sm:py-4 rounded-full font-bold flex items-center shadow-lg shadow-yellow-500/20">
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
                          <button onClick={() => setIsUploading(true)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg shadow-yellow-500/20">
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
            )}
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
