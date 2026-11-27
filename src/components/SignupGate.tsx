import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, Heart, Sparkles, Star } from 'lucide-react';
import type { PublicVideo } from '../../shared/types';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/settings';
import PasswordStrength from './PasswordStrength';
import { Thumb } from './Media';
import { Alert, Button, Field, Input, Modal, cx } from './ui';

/**
 * "Create a free account to watch". Shown when a signed-out visitor taps Watch (if the site requires it).
 * After signing up or in, one more tap continues to the video (browsers only open a new tab from a tap).
 */
export default function SignupGate({ open, onClose, video, site, onContinue }: {
  open: boolean;
  onClose: () => void;
  video: PublicVideo;
  site: string;
  onContinue: () => void;
}) {
  const { user, login, register } = useAuth();
  const { settings } = useSettings();
  const [tab, setTab] = useState<'join' | 'signin'>(settings.allowRegistration ? 'join' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [needsPin, setNeedsPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) setError(''); }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (tab === 'join') await register({ name: name.trim(), email: email.trim(), password, role: 'CONSUMER', source: 'gate' });
      else await login(email.trim(), password, needsPin ? pin : undefined);
    } catch (x: any) {
      if (x.data?.requiresPin) setNeedsPin(true);
      setError(x.data?.passwordFailures?.length ? `${x.message} ${x.data.passwordFailures.join(' · ')}` : x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={user ? 'You’re all set' : 'Watch for free'} sheet>
      <div data-testid="signup-gate">
        <div className="flex items-center gap-3 rounded-2xl bg-zinc-900/70 p-2.5">
          <Thumb src={video.thumbnailUrl} focus={video.thumbFocus} alt="" className="h-14 w-24 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold leading-snug">{video.title}</p>
            <p className="text-xs text-zinc-500">on {site}</p>
          </div>
        </div>

        {user ? (
          <div className="mt-5 space-y-4 text-center">
            <p className="flex items-center justify-center gap-2 text-sm text-emerald-300"><Check className="h-4 w-4" /> Signed in as {user.name}</p>
            <Button className="h-12 w-full text-base" onClick={onContinue} data-testid="gate-continue">
              Continue to {site} <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <ul className="mt-4 grid gap-2 text-sm text-zinc-300">
              <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 shrink-0 text-brand-400" /> Free, takes 20 seconds</li>
              <li className="flex items-center gap-2"><Heart className="h-4 w-4 shrink-0 text-brand-400" /> Picks for you, based on what you watch</li>
              <li className="flex items-center gap-2"><Star className="h-4 w-4 shrink-0 text-brand-400" /> Every video, on any device</li>
            </ul>

            <div className="mt-5 grid grid-cols-2 rounded-full bg-zinc-900 p-1 text-sm" role="tablist">
              {(['join', 'signin'] as const).filter((t) => t === 'signin' || settings.allowRegistration).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setError(''); }} className={cx('ripple h-10 rounded-full font-semibold transition-colors', tab === t ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-white', !settings.allowRegistration && 'col-span-2')}>
                  {t === 'join' ? 'Create account' : 'Sign in'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-4 space-y-3">
              {tab === 'join' && (
                <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} /></Field>
              )}
              <Field label={tab === 'join' ? 'Email' : 'Email or username'}>
                <Input type={tab === 'join' ? 'email' : 'text'} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete={tab === 'join' ? 'email' : 'username'} autoCapitalize="none" required />
              </Field>
              <Field label="Password">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === 'join' ? 'new-password' : 'current-password'} required />
              </Field>
              {tab === 'join' && <PasswordStrength password={password} context={{ email, name }} />}
              {tab === 'signin' && needsPin && (
                <Field label="Security PIN"><Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" /></Field>
              )}
              {error && <Alert>{error}</Alert>}
              <Button type="submit" loading={busy} className="h-12 w-full text-base" data-testid="gate-submit">
                {tab === 'join' ? 'Create free account' : 'Sign in'}
              </Button>
              {tab === 'signin' && <p className="text-center text-xs text-zinc-500"><Link to="/forgot-password" onClick={onClose} className="underline hover:text-zinc-300">Forgot your password?</Link></p>}
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}
