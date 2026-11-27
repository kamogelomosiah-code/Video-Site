import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePageTitle } from '../lib/settings';
import { checkPassword } from '../../shared/password';
import PasswordStrength from '../components/PasswordStrength';
import { Alert, Button, Field, ImageInput, Input, Textarea, useToast } from '../components/ui';
import type { User } from '../../shared/types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Profile + password (+ PIN for admins). Used on /account and inside the admin panel. */
export function AccountForms() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState({ name: user?.name || '', bio: user?.bio || '', avatarUrl: user?.avatarUrl || '' });
  const [pw, setPw] = useState({ currentPassword: '', password: '', confirm: '' });
  const [pin, setPin] = useState('');
  const [pinPassword, setPinPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [pwError, setPwError] = useState<{ msg: string; failures?: string[] } | null>(null);
  if (!user) return null;

  const save = async (kind: string, body: Record<string, unknown>, after?: () => void) => {
    setBusy(kind);
    try {
      const r = await api.put<{ user: User }>('/auth/profile', body);
      setUser(r.user);
      after?.();
      toast('Saved');
      return true;
    } catch (x: any) {
      if (kind === 'password') setPwError({ msg: x.message, failures: x.data?.passwordFailures });
      else toast(x.message, 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    const check = checkPassword(pw.password, { email: user.email, name: user.name });
    if (!check.ok) return setPwError({ msg: 'Please choose a stronger password.', failures: check.failures });
    if (pw.password !== pw.confirm) return setPwError({ msg: 'New passwords do not match.' });
    save('password', { currentPassword: pw.currentPassword, password: pw.password }, () => setPw({ currentPassword: '', password: '', confirm: '' }));
  };

  return (
    <div className="space-y-6">
      <Section title="Profile">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save('profile', profile);
          }}
          className="space-y-4"
        >
          <Field label="Display name">
            <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required maxLength={80} />
          </Field>
          <Field label="Email" hint="Contact an admin to change your email.">
            <Input value={user.email || ''} disabled />
          </Field>
          <Field label="Profile picture" group>
            <ImageInput value={profile.avatarUrl} onChange={(avatarUrl) => setProfile({ ...profile, avatarUrl })} label="Profile picture" />
          </Field>
          <Field label="Bio">
            <Textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} maxLength={1000} />
          </Field>
          <Button type="submit" loading={busy === 'profile'}>Save profile</Button>
        </form>
      </Section>

      <Section title="Change password">
        <form onSubmit={savePassword} className="space-y-4">
          <Field label="Current password">
            <Input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" required />
          </Field>
          <Field label="New password">
            <Input type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} autoComplete="new-password" required />
          </Field>
          <PasswordStrength password={pw.password} context={{ email: user.email, name: user.name }} />
          <Field label="Confirm new password">
            <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" required />
          </Field>
          {pwError && (
            <Alert>
              {pwError.msg}
              {!!pwError.failures?.length && <ul className="mt-1 list-disc pl-4">{pwError.failures.map((f) => <li key={f}>{f}</li>)}</ul>}
            </Alert>
          )}
          <Button type="submit" loading={busy === 'password'}>Update password</Button>
        </form>
      </Section>

      {user.role === 'ADMIN' && (
        <Section title="Admin security PIN">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save('pin', { pin, currentPassword: pinPassword }, () => { setPin(''); setPinPassword(''); });
            }}
            className="space-y-4"
          >
            <Field label="New 6-digit PIN" hint="Asked for every time you sign in as admin.">
              <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="max-w-40 font-mono tracking-widest" required />
            </Field>
            <Field label="Your password" hint="Needed to change the PIN.">
              <Input type="password" value={pinPassword} onChange={(e) => setPinPassword(e.target.value)} autoComplete="current-password" required />
            </Field>
            <Button type="submit" loading={busy === 'pin'} disabled={pin.length !== 6 || !pinPassword}>Update PIN</Button>
          </form>
        </Section>
      )}
    </div>
  );
}

export default function AccountPage() {
  usePageTitle('My account');
  const { user, loading } = useAuth();
  if (!loading && !user) return <Navigate to="/login" state={{ from: '/account' }} replace />;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">My account</h1>
      <AccountForms />
    </div>
  );
}
