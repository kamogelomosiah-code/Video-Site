import React, { useState, useRef, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, MailCheck, AlertCircle, Eye, EyeOff, ShieldCheck, Sparkles, CheckCircle2, ChevronLeft } from 'lucide-react';
import { UserRole } from '../types';
import { api } from '../services/api';

// Hardcoded Administrator credentials
export const HARDCODED_ADMIN = {
  email: 'kamogelomosiah@gmail.com',
  username: 'admin',
  password: '#Eightmillionby30$',
  defaultPin: '225533',
};

interface AuthProps {
  onLogin: (data: any) => void;
  onNavigateBack: () => void;
  onNavigateReset?: (token: string) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onNavigateBack, onNavigateReset }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgotPassword'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CONSUMER);
  const [pin, setPin] = useState('');
  const [needsPin, setNeedsPin] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Check if current input matches the hardcoded admin credentials
  const cleanEmail = email.trim().toLowerCase();
  const isEmailAdmin = cleanEmail === HARDCODED_ADMIN.email.toLowerCase() || 
                       cleanEmail === HARDCODED_ADMIN.username.toLowerCase();
  const isPasswordAdmin = password === HARDCODED_ADMIN.password;
  const isAdminCredentialsEntered = isEmailAdmin || isPasswordAdmin;

  // Show the PIN tab/field whenever admin credentials are entered or when required
  const isPinRequired = isAdminCredentialsEntered || needsPin || showPinInput;

  // Auto-focus PIN field when admin credentials are recognized and password is provided
  useEffect(() => {
    if (isAdminCredentialsEntered && password && !pin) {
      const timer = setTimeout(() => {
        pinInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isAdminCredentialsEntered, password, pin]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    let pinToSend = pin.trim();
    if (isAdminCredentialsEntered && !pinToSend) {
      pinToSend = HARDCODED_ADMIN.defaultPin;
      setPin(HARDCODED_ADMIN.defaultPin);
    }

    try {
      if (authMode === 'login') {
        const user = await api.auth.login(email.trim(), password, pinToSend || undefined);
        onLogin(user);
      } else {
        const newUser = await api.auth.register({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role
        });
        onLogin(newUser);
      }
    } catch (err: any) {
      if (err?.data?.requiresPin || err?.message?.toLowerCase().includes('pin required')) {
        setNeedsPin(true);
        if (isAdminCredentialsEntered && !pin) {
          setPin(HARDCODED_ADMIN.defaultPin);
        }
        setError('Security PIN required for administrator access. Please enter your 6-digit PIN below.');
        return;
      }
      setError(err.message || 'Authentication failed. Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await api.auth.forgotPassword(email.trim().toLowerCase());
      if (res.resetUrl) {
        setResetUrl(res.resetUrl);
      }
      setResetEmailSent(true);
    } catch (err: any) {
      setError(err.message || 'Could not send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetForm = (mode: 'login' | 'register' | 'forgotPassword') => {
    setAuthMode(mode);
    setError('');
    setEmail('');
    setPassword('');
    setName('');
    setPin('');
    setNeedsPin(false);
    setShowPinInput(false);
    setShowPassword(false);
    setResetEmailSent(false);
    setResetUrl(null);
  };

  const renderAuthForms = () => (
    <div className="space-y-6">
      {/* Mode Switcher Tabs */}
      <div className="flex bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 gap-1">
        <button
          type="button"
          onClick={() => { resetForm('login'); }}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            authMode === 'login'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-zinc-950 shadow-md font-bold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { resetForm('register'); }}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            authMode === 'register'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-zinc-950 shadow-md font-bold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Create Account
        </button>
        {authMode === 'login' && isPinRequired && (
          <button
            type="button"
            onClick={() => {
              setShowPinInput(true);
              if (!pin) setPin(HARDCODED_ADMIN.defaultPin);
              setTimeout(() => pinInputRef.current?.focus(), 50);
            }}
            className="flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/40 shadow-sm flex items-center justify-center gap-1.5 animate-fade-in cursor-pointer active:scale-95"
            title="Open Security PIN entry"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-yellow-400" />
            <span>PIN Tab</span>
          </button>
        )}
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {authMode === 'login' ? 'Welcome Back' : 'Join Elysian'}
        </h2>
        <p className="text-sm text-zinc-400">
          {authMode === 'login' 
            ? 'Access your private vault, creators, and exclusive streams.' 
            : 'Experience verified creators and uncompressed 4K media.'}
        </p>
      </div>

      <form onSubmit={handleLoginSubmit} className="space-y-4 sm:space-y-5">
        {authMode === 'register' && (
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-medium text-zinc-300">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-yellow-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all"
                placeholder="e.g. Alex Morgan"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-medium text-zinc-300">
            {authMode === 'login' ? 'Email or Username' : 'Email Address'}
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type={authMode === 'login' ? 'text' : 'email'}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-yellow-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all"
              placeholder={authMode === 'login' ? 'Email or username' : 'name@example.com'}
              autoComplete="username"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-medium text-zinc-300">Password</label>
            {authMode === 'login' && (
              <button
                type="button"
                onClick={() => resetForm('forgotPassword')}
                className="text-xs text-yellow-500 hover:text-yellow-400 font-medium transition-colors"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-yellow-500 rounded-xl py-3 pl-10 pr-11 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all"
              placeholder="••••••••••••"
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Security PIN Gate (Required for Admin accounts or optionally entered) */}
        {authMode === 'login' && isPinRequired && (
          <div className="space-y-1.5 p-3.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl animate-fade-in">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-yellow-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Security PIN {isAdminCredentialsEntered && '— Admin Account'}</span>
              </label>
              <div className="flex items-center gap-2">
                {isAdminCredentialsEntered && (
                  <button
                    type="button"
                    onClick={() => setPin(HARDCODED_ADMIN.defaultPin)}
                    className="text-[10px] text-yellow-400 hover:text-yellow-300 underline font-medium cursor-pointer"
                  >
                    Use Admin PIN ({HARDCODED_ADMIN.defaultPin})
                  </button>
                )}
                <span className="text-[10px] text-yellow-500/80 font-mono">6 digits</span>
              </div>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-500" />
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-zinc-950 border border-yellow-500/50 focus:border-yellow-400 rounded-lg py-2.5 pl-10 pr-4 text-sm text-yellow-300 tracking-widest font-mono text-center focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all placeholder:text-zinc-700"
                placeholder="••••••"
                autoFocus={isPinRequired}
              />
            </div>
            {isAdminCredentialsEntered && (
              <p className="text-[11px] text-yellow-500/90 font-medium">
                Admin credentials recognized. Enter your 6-digit security PIN to unlock administrator access.
              </p>
            )}
          </div>
        )}

        {authMode === 'login' && !isPinRequired && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setShowPinInput(true);
                setTimeout(() => pinInputRef.current?.focus(), 50);
              }}
              className="text-[11px] text-zinc-500 hover:text-zinc-400 transition-colors cursor-pointer"
            >
              Have a security PIN?
            </button>
          </div>
        )}

        {/* Role Picker for Registration */}
        {authMode === 'register' && (
          <div className="space-y-2 pt-1">
            <label className="text-xs sm:text-sm font-medium text-zinc-300">Choose Account Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole(UserRole.CONSUMER)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  role === UserRole.CONSUMER
                    ? 'bg-yellow-500/10 border-yellow-500 text-white shadow-sm ring-1 ring-yellow-500/30'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="font-semibold text-xs sm:text-sm text-yellow-400 mb-0.5">Viewer / Client</div>
                <div className="text-[11px] text-zinc-400 line-clamp-2">Explore 4K media, unlock feeds & book services</div>
              </button>
              <button
                type="button"
                onClick={() => setRole(UserRole.CREATOR)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  role === UserRole.CREATOR
                    ? 'bg-yellow-500/10 border-yellow-500 text-white shadow-sm ring-1 ring-yellow-500/30'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="font-semibold text-xs sm:text-sm text-yellow-400 mb-0.5">Creator / Talent</div>
                <div className="text-[11px] text-zinc-400 line-clamp-2">Publish media, monetize subscriptions & accept chats</div>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-950/70 border border-red-800/80 text-red-200 text-xs sm:text-sm rounded-xl p-3 flex items-start gap-2.5 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-zinc-950 font-bold py-3 sm:py-3.5 rounded-xl transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin"></div>
          ) : (
            <>
              <span>{authMode === 'login' ? (isAdminCredentialsEntered ? 'Sign In as Admin' : 'Sign In') : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </button>
      </form>
    </div>
  );

  const renderForgotPasswordForm = () => (
    <div className="space-y-6">
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => resetForm('login')}
          className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 mb-2 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Sign In
        </button>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Reset Password</h2>
        <p className="text-sm text-zinc-400">
          Enter your account email address and we'll dispatch a secure recovery link.
        </p>
      </div>

      <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-medium text-zinc-300">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-yellow-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all"
              placeholder="name@example.com"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-950/70 border border-red-800/80 text-red-200 text-xs sm:text-sm rounded-xl p-3 flex items-start gap-2.5 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-zinc-950 font-bold py-3 sm:py-3.5 rounded-xl transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin"></div>
          ) : (
            <>
              <span>Send Recovery Link</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </button>
      </form>
    </div>
  );
  
  const renderConfirmation = () => {
    let tokenFromUrl = '';
    if (resetUrl) {
      try {
        const parsed = new URL(resetUrl);
        tokenFromUrl = parsed.searchParams.get('token') || '';
      } catch {
        const match = resetUrl.match(/[?&]token=([^&#]+)/);
        if (match) tokenFromUrl = match[1];
      }
    }

    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-green-500/10">
          <MailCheck className="w-8 h-8 text-green-400" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold text-white">Reset Link Dispatched</h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
            If an account is registered for <span className="text-white font-medium">{email}</span>, a secure recovery link is active for the next 30 minutes.
          </p>
        </div>

        {resetUrl && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl text-left space-y-2.5">
            <div className="flex items-center gap-1.5 text-yellow-400 font-semibold text-xs uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Direct Reset Available</span>
            </div>
            <p className="text-xs text-zinc-300">
              Click below to proceed to the secure reset password page:
            </p>
            <button
              type="button"
              onClick={() => {
                if (tokenFromUrl && onNavigateReset) {
                  onNavigateReset(tokenFromUrl);
                } else {
                  window.location.href = resetUrl;
                }
              }}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold py-2.5 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open Reset Password Page</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <button 
          type="button" 
          onClick={() => resetForm('login')} 
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm cursor-pointer"
        >
          Return to Sign In
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-black relative">
      {/* Top Floating Guest Link */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <button
          type="button"
          onClick={onNavigateBack}
          className="text-xs sm:text-sm text-zinc-400 hover:text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-all cursor-pointer backdrop-blur-md"
        >
          Continue as Guest
        </button>
      </div>

      {/* Left Column (Desktop Hero Showcase) */}
      <div className="hidden lg:flex w-1/2 relative bg-zinc-950 border-r border-zinc-900 overflow-hidden items-center justify-center p-12 xl:p-16">
        {/* Ambient Glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-lg space-y-8">
          {/* Logo Badge */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/25 p-2">
              <img src="/peach-svgrepo-com.svg" alt="Elysian Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
                Elysian
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-yellow-500">
                Creator & Talent Network
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight">
              The Gold Standard in <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-600">Exclusive Media</span>
            </h1>
            <p className="text-base text-zinc-400 leading-relaxed">
              Connect directly with verified premier talent, stream 4K productions in high dynamic range, and unlock custom virtual bookings.
            </p>
          </div>

          {/* Pillars List */}
          <div className="space-y-3.5 pt-2">
            {[
              { title: 'Bank-Grade Verified Creators', desc: '100% ID-authenticated models and professionals.' },
              { title: 'Ultra-HD Lossless Feeds', desc: 'Instant 4K multi-angle streams with adaptive bitrates.' },
              { title: 'Private & Direct VIP Chats', desc: 'End-to-end secured communications and bookings.' },
            ].map((pillar, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-zinc-900/40 border border-zinc-850/80 rounded-xl p-3.5 backdrop-blur-sm">
                <CheckCircle2 className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-white">{pillar.title}</div>
                  <div className="text-xs text-zinc-400">{pillar.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Verified Creator Stat Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-xs text-yellow-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Platform Active • Over 5,000 Verified Community Members</span>
          </div>
        </div>
      </div>

      {/* Right Column (Responsive Form Container) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-12 sm:px-8 sm:py-16">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/20 p-2">
              <img src="/peach-svgrepo-com.svg" alt="Elysian Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-white">Elysian</span>
          </div>

          {/* Auth Card */}
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            {resetEmailSent ? renderConfirmation() : authMode === 'forgotPassword' ? renderForgotPasswordForm() : renderAuthForms()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;