import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSettings, usePageTitle } from '../lib/settings';
import { checkPassword } from '../../shared/password';
import PasswordStrength from '../components/PasswordStrength';
import { Alert, Button, Field, Input, Spinner, cx } from '../components/ui';
import type { User } from '../../shared/types';

function Card({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-6 sm:py-10">
      <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function PasswordInput(props: { value: string; onChange: (v: string) => void; autoComplete: string; label?: string; id?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={props.id}
        type={show ? 'text' : 'password'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        aria-label={props.label || 'Password'}
        required
        className="pr-10"
      />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ErrorList({ error, failures }: { error: string; failures?: string[] }) {
  if (!error) return null;
  return (
    <Alert>
      {error}
      {!!failures?.length && <ul className="mt-1 list-disc pl-4">{failures.map((f) => <li key={f}>{f}</li>)}</ul>}
    </Alert>
  );
}

const afterLogin = (u: User, from?: string) => (from && from !== '/login' ? from : u.role === 'ADMIN' ? '/admin' : '/');

export function LoginPage() {
  usePageTitle('Sign in');
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as any)?.from as string | undefined;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [needsPin, setNeedsPin] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) navigate(afterLogin(user, from), { replace: true });
  }, [user, from, navigate]);
  useEffect(() => {
    if (needsPin) pinRef.current?.focus();
  }, [needsPin]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password, needsPin ? pin.trim() : undefined);
    } catch (x: any) {
      if (x.data?.requiresPin) {
        if (needsPin) setPin('');
        setNeedsPin(true);
        setError(needsPin ? x.message : '');
      } else {
        setError(x.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Welcome back" subtitle="Sign in to your account.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email or username">
          <Input value={email} onChange={(e) => { setEmail(e.target.value); setNeedsPin(false); }} autoComplete="username" required autoFocus />
        </Field>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-medium text-zinc-300">Password</label>
            <Link to="/forgot-password" className="text-xs text-brand-400 hover:underline">Forgot password?</Link>
          </div>
          <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        {needsPin && (
          <div className="space-y-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3.5 animate-fade-in">
            <label htmlFor="pin" className="flex items-center gap-1.5 text-sm font-medium text-brand-300">
              <ShieldCheck className="h-4 w-4" /> Admin security PIN
            </label>
            <Input
              ref={pinRef}
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 digits"
              className="text-center font-mono tracking-[0.5em]"
              required
            />
          </div>
        )}
        <ErrorList error={error} />
        <Button type="submit" loading={busy} className="w-full">{needsPin ? 'Verify PIN & sign in' : 'Sign in'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-400">
        New here? <Link to="/register" className="text-brand-400 hover:underline">Create an account</Link>
      </p>
    </Card>
  );
}

export function RegisterPage() {
  usePageTitle('Create account');
  const { register, user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'CONSUMER' });
  const [error, setError] = useState('');
  const [failures, setFailures] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  if (!settings.allowRegistration) {
    return <Card title="Sign-ups are closed">New accounts can't be created right now. <Link to="/login" className="text-brand-400">Sign in</Link></Card>;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFailures([]);
    const email = form.email.trim().toLowerCase();
    const pw = checkPassword(form.password, { email, name: form.name.trim() });
    if (!pw.ok) {
      setError('Please choose a stronger password.');
      setFailures(pw.failures);
      return;
    }
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await register({ name: form.name.trim(), email, password: form.password, role: form.role });
    } catch (x: any) {
      setError(x.message);
      setFailures(x.data?.passwordFailures || []);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={`Join ${settings.siteName}`} subtitle="You must be 18 or older to create an account.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name">
          <Input value={form.name} onChange={(e) => set('name')(e.target.value)} autoComplete="name" required maxLength={80} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} autoComplete="email" required />
        </Field>
        <Field label="Password">
          <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <PasswordStrength password={form.password} context={{ email: form.email, name: form.name }} />
        <Field label="Confirm password" error={form.confirm && form.confirm !== form.password ? 'Passwords do not match' : undefined}>
          <PasswordInput value={form.confirm} onChange={set('confirm')} autoComplete="new-password" label="Confirm password" />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-300">I want to</legend>
          <div className="grid grid-cols-2 gap-2">
            {[{ v: 'CONSUMER', t: 'Watch', d: 'Browse & comment' }, { v: 'CREATOR', t: 'Create', d: 'I make content' }].map((o) => (
              <label key={o.v} className={cx('cursor-pointer rounded-lg border p-3', form.role === o.v ? 'border-brand-500 bg-brand-500/10' : 'border-zinc-800')}>
                <input type="radio" name="role" value={o.v} checked={form.role === o.v} onChange={() => set('role')(o.v)} className="sr-only" />
                <span className="block text-sm font-semibold">{o.t}</span>
                <span className="block text-xs text-zinc-500">{o.d}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <ErrorList error={error} failures={failures} />
        <Button type="submit" loading={busy} className="w-full">Create account</Button>
        <p className="text-center text-xs text-zinc-500">
          By joining you confirm you're 18+ and agree to the <Link to="/terms" className="underline">terms</Link> and <Link to="/privacy" className="underline">privacy policy</Link>.
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-400">
        Already have an account? <Link to="/login" className="text-brand-400 hover:underline">Sign in</Link>
      </p>
    </Card>
  );
}

export function ForgotPasswordPage() {
  usePageTitle('Reset password');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<{ devResetUrl?: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setSent(await api.post('/auth/forgot-password', { email: email.trim() }));
    } catch (x: any) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Card title="Check your email">
        <p className="text-sm text-zinc-300">If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. It expires in 30 minutes.</p>
        {sent.devResetUrl && (
          <div className="mt-4">
            <Alert kind="info">
              No email service is configured (development mode).{' '}
              <a href={sent.devResetUrl} className="text-brand-400 underline">Open the reset link</a>
            </Alert>
          </div>
        )}
        <Link to="/login" className="mt-6 inline-block text-sm text-brand-400 hover:underline">Back to sign in</Link>
      </Card>
    );
  }
  return (
    <Card title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
        </Field>
        <ErrorList error={error} />
        <Button type="submit" loading={busy} className="w-full">Send reset link</Button>
      </form>
      <Link to="/login" className="mt-6 inline-block text-sm text-zinc-400 hover:text-white">← Back to sign in</Link>
    </Card>
  );
}

export function ResetPasswordPage() {
  usePageTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<{ loading: boolean; email?: string; invalid?: string }>({ loading: true });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [failures, setFailures] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return setState({ loading: false, invalid: 'This reset link is missing its token.' });
    api
      .get<{ email: string }>(`/auth/reset-password/${encodeURIComponent(token)}`)
      .then((r) => setState({ loading: false, email: r.email }))
      .catch((x) => setState({ loading: false, invalid: x.message }));
  }, [token]);

  if (state.loading) return <Spinner />;
  if (state.invalid) {
    return (
      <Card title="Link expired">
        <p className="text-sm text-zinc-300">{state.invalid}</p>
        <Link to="/forgot-password" className="mt-4 inline-block text-sm text-brand-400 hover:underline">Request a new link</Link>
      </Card>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFailures([]);
    const pw = checkPassword(password, { email: state.email });
    if (!pw.ok) {
      setError('Please choose a stronger password.');
      setFailures(pw.failures);
      return;
    }
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const r = await api.post<{ user: User; token: string }>('/auth/reset-password', { token, password });
      setSession(r.user, r.token);
      navigate(r.user.role === 'ADMIN' ? '/admin' : '/', { replace: true });
    } catch (x: any) {
      setError(x.message);
      setFailures(x.data?.passwordFailures || []);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Choose a new password" subtitle={state.email ? `For ${state.email}` : undefined}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" label="New password" />
        </Field>
        <PasswordStrength password={password} context={{ email: state.email }} />
        <Field label="Confirm new password" error={confirm && confirm !== password ? 'Passwords do not match' : undefined}>
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" label="Confirm new password" />
        </Field>
        <ErrorList error={error} failures={failures} />
        <Button type="submit" loading={busy} className="w-full">Save password & sign in</Button>
      </form>
    </Card>
  );
}
