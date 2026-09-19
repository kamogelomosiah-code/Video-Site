import React, { useEffect, useState } from 'react';
import { Lock, ArrowRight, AlertCircle, CheckCircle, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { api } from '../services/api';
import PasswordStrength from '../components/PasswordStrength';
import { checkPassword } from '../utils/password';
import { User } from '../types';

interface Props {
  token?: string;
  onNavigateLogin: () => void;
  onLoginSuccess?: (user: User) => void;
}

const ResetPassword: React.FC<Props> = ({ token: initialToken = '', onNavigateLogin, onLoginSuccess }) => {
  const [activeToken, setActiveToken] = useState<string>(initialToken);
  const [tokenInput, setTokenInput] = useState('');
  const [status, setStatus] = useState<'checking' | 'form' | 'success' | 'error' | 'manual-entry'>(
    initialToken ? 'checking' : 'manual-entry'
  );
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If token is in URL query parameter, pick it up
  useEffect(() => {
    if (!activeToken) {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        setActiveToken(urlToken);
        setStatus('checking');
      }
    }
  }, [activeToken]);

  useEffect(() => {
    if (!activeToken) {
      setStatus('manual-entry');
      return;
    }

    setStatus('checking');
    setError(null);

    api.auth.verifyResetToken(activeToken)
      .then((r) => {
        if (r.valid) {
          setEmail(r.email || null);
          setStatus('form');
        } else {
          setError(r.error || 'Invalid or expired reset token');
          setStatus('error');
        }
      })
      .catch((e) => {
        setError(e.message || 'Could not verify reset token');
        setStatus('error');
      });
  }, [activeToken]);

  const pwdCheck = checkPassword(password, { email: email || undefined });
  const canSubmit = pwdCheck.ok && password === confirm && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.auth.resetPassword(activeToken, password);
      setStatus('success');
      
      // Auto login the user and transition to main app
      if (res.user && onLoginSuccess) {
        setTimeout(() => {
          onLoginSuccess(res.user!);
        }, 1200);
      } else {
        setTimeout(() => {
          onNavigateLogin();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Password reset failed. Please try again.');
      setSubmitting(false);
    }
  };

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setError('Please enter your reset token');
      return;
    }
    setActiveToken(trimmed);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md bg-[#111] border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Brand Header */}
        <div className="flex items-center justify-center space-x-2 pb-2 border-b border-zinc-800/80">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
            <Lock className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-wider text-white">ELYSIAN SECURITY</span>
        </div>

        {/* Status: Checking Token */}
        {status === 'checking' && (
          <div className="text-center py-8 space-y-4">
            <Loader2 className="w-10 h-10 text-yellow-500 mx-auto animate-spin" />
            <p className="text-white font-medium">Verifying reset token...</p>
            <p className="text-zinc-500 text-xs">Ensuring secure authentication credentials</p>
          </div>
        )}

        {/* Status: Manual Token Entry (when no token in URL) */}
        {status === 'manual-entry' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-yellow-500/10 border border-yellow-500/20 rounded-full flex items-center justify-center mx-auto text-yellow-400 mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Enter Reset Token</h2>
              <p className="text-zinc-400 text-xs">
                Paste the token from the reset link sent to your email to continue.
              </p>
            </div>

            <form onSubmit={handleManualTokenSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-300 mb-1.5 block">Security Token</label>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    setError(null);
                  }}
                  placeholder="Paste token or enter reset code"
                  required
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 font-mono"
                />
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xl p-3 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold py-3 rounded-xl transition-all shadow-lg shadow-yellow-500/10 flex items-center justify-center space-x-2"
              >
                <span>Continue to Reset</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onNavigateLogin}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}

        {/* Status: Error / Expired */}
        {status === 'error' && (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-red-950/40 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Reset Link Invalid or Expired</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              {error || 'This password reset link is invalid or has already expired. Password reset links expire after 30 minutes.'}
            </p>
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => setStatus('manual-entry')}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-xl text-sm transition-colors"
              >
                Enter Another Token
              </button>
              <button
                type="button"
                onClick={onNavigateLogin}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold py-3 rounded-xl text-sm transition-colors"
              >
                Request New Reset Link
              </button>
            </div>
          </div>
        )}

        {/* Status: Success */}
        {status === 'success' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto text-green-400 animate-pulse">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white">Password Reset!</h2>
            <p className="text-zinc-300 text-sm leading-relaxed">
              Your new password has been saved securely. Logging you in now...
            </p>
            <div className="flex items-center justify-center pt-2 space-x-2 text-zinc-400 text-xs">
              <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
              <span>Redirecting to your account...</span>
            </div>
          </div>
        )}

        {/* Status: Active Form */}
        {status === 'form' && (
          <>
            <div className="space-y-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-white">Reset Your Password</h1>
              {email ? (
                <p className="text-zinc-400 text-xs">
                  Create a new password for <span className="text-yellow-400 font-medium">{email}</span>
                </p>
              ) : (
                <p className="text-zinc-400 text-xs">Choose a secure new password for your account</p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs font-medium text-zinc-300 mb-1.5 block">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter new password"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 pr-11 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-2">
                  <PasswordStrength password={password} context={{ email: email || undefined }} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="Confirm new password"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 pr-11 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirm && confirm !== password && (
                  <p className="text-red-400 text-xs mt-1.5 flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1" />
                    Passwords do not match
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xl p-3 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold py-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span>Saving & Logging In...</span>
                  </>
                ) : (
                  <>
                    <span>Save Password & Log In</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onNavigateLogin}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Remember your password? <span className="text-yellow-400 hover:underline">Sign In</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
