import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useSettings, usePageTitle } from '../lib/settings';
import { Logo } from '../components/Layout';

const DEFAULT_PRIVACY = `We collect only what we need to run the site: your account details (name, email) if you register, and basic usage information such as pages viewed. Passwords are stored securely hashed and are never visible to anyone, including administrators.

We use cookies to keep you signed in, to remember that you confirmed your age, and — only if you agree — for advertising.

You can ask us to delete your account and data at any time by contacting us.`;

const DEFAULT_TERMS = `This site is for adults only. By using it you confirm you are at least 18 years old and that viewing adult content is legal where you live.

You agree not to upload, link to or share content you don't have the rights to, and not to harass other users. We may remove content or suspend accounts that break these rules.

Content is provided as-is. Links to third-party sites are not under our control.`;

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const { settings } = useSettings();
  const title = kind === 'privacy' ? 'Privacy policy' : 'Terms of service';
  usePageTitle(title);
  const body = (kind === 'privacy' ? settings.privacyPolicy : settings.termsOfService) || (kind === 'privacy' ? DEFAULT_PRIVACY : DEFAULT_TERMS);
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold">{title}</h1>
      <div className="whitespace-pre-wrap leading-relaxed text-zinc-300">{body}</div>
      {settings.contactEmail && (
        <p className="mt-8 text-sm text-zinc-400">
          Questions? <a href={`mailto:${settings.contactEmail}`} className="text-brand-400">{settings.contactEmail}</a>
        </p>
      )}
    </article>
  );
}

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="py-24 text-center">
      <p className="text-6xl font-extrabold text-brand-500">404</p>
      <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-6 inline-block text-brand-400 hover:underline">Go to the homepage</Link>
    </div>
  );
}

export function MaintenancePage() {
  const { settings } = useSettings();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center" data-testid="maintenance">
      <Logo />
      <Wrench className="h-12 w-12 text-brand-500" />
      <h1 className="text-2xl font-bold">Down for maintenance</h1>
      <p className="max-w-md text-zinc-400">{settings.maintenanceMessage}</p>
      <Link to="/login" className="text-xs text-zinc-600 hover:text-zinc-400">Admin sign in</Link>
    </div>
  );
}
