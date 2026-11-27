import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSettings, usePageTitle } from '../lib/settings';
import { checkPassword } from '../../shared/password';
import PasswordStrength from '../components/PasswordStrength';
import { Alert, Button, Field, Input, cx } from '../components/ui';
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

function PasswordInput(props: { value: string; onChange: (v: string) => void; autoComplete: string; label?: string; id?: string; autoFocus?: boolean }) {
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
        autoFocus={props.autoFocus}
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

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];
const afterLogin = (u: User, from?: string) => (from && !AUTH_PATHS.includes(from) ? from : u.role === 'ADMIN' ? '/admin' : '/');

/** Carried between the sign-in, sign-up and reset pages, so nothing has to be typed twice. */
type AuthNav = { from?: string; email?: string; notice?: string };
const useAuthNav = () => (useLocation().state || {}) as AuthNav;

function PinInput({ value, onChange, inputRef }: { value: string; onChange: (v: string) => void; inputRef: Ref<HTMLInputElement> }) {
  return (
    <Input
      ref={inputRef}
      id="pin"
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      autoComplete="off"
      placeholder="••••••"
      className="text-center font-mono text-lg tracking-[0.5em]"
      required
    />
  );
}

export function LoginPage() {
  usePageTitle('Sign in');
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const nav = useAuthNav();
  const [email, setEmail] = useState(nav.email || '');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [needsPin, setNeedsPin] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) navigate(afterLogin(user, nav.from), { replace: true });
  }, [user, nav.from, navigate]);
  useEffect(() => {
    if (needsPin && !busy) pinRef.current?.focus();
  }, [needsPin, busy]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password, needsPin ? pin : undefined);
    } catch (x: any) {
      if (x.data?.requiresPin) {
        setPin('');
        setNeedsPin(true);
        setError(needsPin ? x.message : '');
      } else {
        setError(x.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setNeedsPin(false);
    setPin('');
    setPassword('');
    setError('');
  };
  const carry: AuthNav = { from: nav.from, email: email.includes('@') ? email.trim() : undefined };

  if (needsPin) {
    return (
      <Card title="Enter your PIN" subtitle="One more step: your 6-digit admin security PIN.">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="pin" className="flex items-center gap-1.5 text-sm font-medium text-brand-300">
              <ShieldCheck className="h-4 w-4" /> Security PIN
            </label>
            <PinInput value={pin} onChange={setPin} inputRef={pinRef} />
          </div>
          <ErrorList error={error} />
          <Button type="submit" loading={busy} disabled={pin.length !== 6} className="w-full">Verify PIN &amp; sign in</Button>
        </form>
        <button type="button" onClick={back} className="mt-6 text-sm text-zinc-400 hover:text-white">← Back to sign in</button>
      </Card>
    );
  }

  return (
    <Card title="Welcome back" subtitle="Sign in to your account.">
      {nav.notice && <div className="mb-4"><Alert kind="success">{nav.notice}</Alert></div>}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email or username">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus={!nav.email} />
        </Field>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-medium text-zinc-300">Password</label>
            <Link to="/forgot-password" state={carry} className="text-xs text-brand-400 hover:underline">Forgot password?</Link>
          </div>
          <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus={!!nav.email} />
        </div>
        <ErrorList error={error} />
        <Button type="submit" loading={busy} className="w-full">Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-400">
        New here? <Link to="/register" state={carry} className="text-brand-400 hover:underline">Create an account</Link>
      </p>
    </Card>
  );
}

export function RegisterPage() {
  usePageTitle('Create account');
  const { register, user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const nav = useAuthNav();
  const [form, setForm] = useState({ name: '', email: nav.email || '', password: '', confirm: '', role: 'CONSUMER' });
  const [taken, setTaken] = useState(false);
  const [error, setError] = useState('');
  const [failures, setFailures] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (user) navigate(nav.from && !AUTH_PATHS.includes(nav.from) ? nav.from : '/', { replace: true });
  }, [user, nav.from, navigate]);
  const carry: AuthNav = { from: nav.from, email: form.email.trim() || undefined };

  if (!settings.allowRegistration) {
    return <Card title="Sign-ups are closed">New accounts can't be created right now. <Link to="/login" className="text-brand-400">Sign in</Link></Card>;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFailures([]);
    setTaken(false);
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
      setTaken(x.status === 409);
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
        {taken && (
          <p className="text-sm text-zinc-400">
            <Link to="/login" state={carry} className="text-brand-400 hover:underline">Sign in</Link> or{' '}
            <Link to="/forgot-password" state={carry} className="text-brand-400 hover:underline">reset your password</Link>.
          </p>
        )}
        <Button type="submit" loading={busy} className="w-full">Create account</Button>
        <p className="text-center text-xs text-zinc-500">
          By joining you confirm you're 18+ and agree to the <Link to="/terms" className="underline">terms</Link> and <Link to="/privacy" className="underline">privacy policy</Link>.
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-400">
        Already have an account? <Link to="/login" state={carry} className="text-brand-400 hover:underline">Sign in</Link>
      </p>
    </Card>
  );
}

export function ForgotPasswordPage() {
  usePageTitle('Reset password');
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nav = useAuthNav();
  const [cooldown, setCooldown] = useState(0);
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState(nav.email || params.get('email') || '');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failures, setFailures] = useState<string[]>([]);
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const startOver = () => {
    setStep('email');
    setCode('');
    setPassword('');
    setConfirm('');
    setDevCode(undefined);
    setInfo('');
    setError('');
    setFailures([]);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setFailures([]);
    try {
      await fn();
    } catch (x: any) {
      setError(x.message);
      setFailures(x.data?.passwordFailures || []);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      const r = await api.post<{ devCode?: string }>('/auth/forgot-password', { email: email.trim() });
      setDevCode(r.devCode);
      setCode('');
      setStep('code');
      setCooldown(60);
      setInfo(`If an account exists for ${email.trim()}, a 6-digit code is on its way. Check your inbox and spam folder.`);
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      await api.post('/auth/verify-reset-code', { email: email.trim(), code });
      setInfo('');
      setStep('password');
    });
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const pw = checkPassword(password, { email: email.trim() });
    if (!pw.ok) {
      setError('Please choose a stronger password.');
      setFailures(pw.failures);
      return;
    }
    if (password !== confirm) return setError('Passwords do not match.');
    return run(async () => {
      const r = await api.post<{ user: User; token: string; requiresSignIn?: boolean }>('/auth/reset-password', { email: email.trim(), code, password });
      if (r.requiresSignIn) {
        const notice = 'Password changed. Sign in with your new password and PIN.';
        navigate('/login', { replace: true, state: { email: email.trim(), notice } satisfies AuthNav });
        return;
      }
      setSession(r.user, r.token);
      navigate(r.user.role === 'ADMIN' ? '/admin' : '/', { replace: true });
    });
  };

  const stepLabel = { email: 'Step 1 of 3', code: 'Step 2 of 3', password: 'Step 3 of 3' }[step];

  return (
    <Card
      title={step === 'password' ? 'Choose a new password' : step === 'code' ? 'Enter your code' : 'Forgot your password?'}
      subtitle={<span><span className="text-brand-400">{stepLabel}</span> · {step === 'email' ? "We'll email you a 6-digit code." : email}</span>}
    >
      {info && <div className="mb-4"><Alert kind="info">{info}</Alert></div>}
      {devCode && step === 'code' && (
        <div className="mb-4"><Alert kind="info">No email service is configured (development). Your code is <strong className="font-mono">{devCode}</strong>.</Alert></div>
      )}

      {step === 'email' && (
        <form onSubmit={sendCode} className="space-y-4">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </Field>
          <ErrorList error={error} />
          <Button type="submit" loading={busy} className="w-full">Send code</Button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={verify} className="space-y-4">
          <Field label="6-digit code">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="text-center font-mono text-lg tracking-[0.5em]"
              required
              autoFocus
            />
          </Field>
          <ErrorList error={error} />
          <Button type="submit" loading={busy} disabled={code.length !== 6} className="w-full">Continue</Button>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm">
            <button type="button" onClick={startOver} className="text-zinc-400 hover:text-white">Use a different email</button>
            <button type="button" onClick={() => sendCode()} disabled={busy || cooldown > 0} className="text-brand-400 hover:underline disabled:cursor-not-allowed disabled:text-zinc-500 disabled:no-underline">
              {cooldown > 0 ? `Send a new code (${cooldown}s)` : 'Send a new code'}
            </button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={save} className="space-y-4">
          <Field label="New password">
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" label="New password" />
          </Field>
          <PasswordStrength password={password} context={{ email }} />
          <Field label="Confirm new password" error={confirm && confirm !== password ? 'Passwords do not match' : undefined}>
            <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" label="Confirm new password" />
          </Field>
          <ErrorList error={error} failures={failures} />
          <Button type="submit" loading={busy} className="w-full">Save new password</Button>
          <button type="button" onClick={startOver} className="block w-full text-center text-sm text-zinc-400 hover:text-white">Code expired? Start again</button>
        </form>
      )}

      <Link to="/login" state={{ from: nav.from, email: email.trim() || undefined } satisfies AuthNav} className="mt-6 inline-block text-sm text-zinc-400 hover:text-white">← Back to sign in</Link>
    </Card>
  );
}
