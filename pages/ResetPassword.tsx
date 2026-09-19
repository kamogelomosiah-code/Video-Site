import React, { useEffect, useState } from 'react';
import { Lock, MailCheck, ArrowRight, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import PasswordStrength from '../components/PasswordStrength';
import { checkPassword } from '../utils/password';

interface Props {
  token: string;
  onNavigateLogin: () => void;
}

const ResetPassword: React.FC<Props> = ({ token, onNavigateLogin }) => {
  const [status, setStatus] = useState<'checking' | 'form' | 'success' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.auth.verifyResetToken(token)
      .then((r) => {
        if (r.valid) {
          setEmail(r.email || null);
          setStatus('form');
        } else {
          setError(r.error || 'Invalid or expired token');
          setStatus('error');
        }
      })
      .catch((e) => {
        setError(e.message || 'Could not verify token');
        setStatus('error');
      });
  }, [token]);

  const pwdCheck = checkPassword(password, { email: email || undefined });
  const canSubmit = pwdCheck.ok && password === confirm && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.auth.resetPassword(token, password);
      setStatus('success');
      setTimeout(() => {
        onNavigateLogin();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Reset failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md bg-[#111] border border-zinc-800 rounded-2xl p-8 space-y-6">
        {status === 'checking' && (
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 text-yellow-500 mx-auto animate-spin" />
            <p className="text-zinc-400">Verifying your reset link...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Link invalid</h2>
            <p className="text-zinc-400 text-sm">{error || 'This link may have expired or already been used.'}</p>
            <button
              type="button"
              onClick={onNavigateLogin}
              className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold px-6 py-3 rounded-xl w-full"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-white">Password updated</h2>
            <p className="text-zinc-400 text-sm">Redirecting to sign in...</p>
          </div>
        )}

        {status === 'form' && (
          <>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Set a new password</h1>
              {email && (
                <p className="text-zinc-500 text-xs">Resetting for {email}</p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-zinc-300 mb-2 block">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
                />
                <PasswordStrength password={password} context={{ email: email || undefined }} />
              </div>

              <div>
                <label className="text-sm text-zinc-300 mb-2 block">Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
                />
                {confirm && confirm !== password && (
                  <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                )}
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/30 text-red-300 text-sm rounded-xl p-3 flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Update Password
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-zinc-500">
              Remember it now?
              <button
                type="button"
                onClick={onNavigateLogin}
                className="text-yellow-400 hover:underline ml-1"
              >
                Sign in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
