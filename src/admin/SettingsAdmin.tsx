import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { MediaItem, SiteSettings } from '../../shared/types';
import { api } from '../lib/api';
import { useSettings, usePageTitle } from '../lib/settings';
import { useFetch } from '../lib/utils';
import { Alert, Button, Field, Input, Select, Spinner, Textarea, Toggle, useToast } from '../components/ui';

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default function SettingsAdmin() {
  usePageTitle('Admin · Site settings');
  const { refresh } = useSettings();
  const { toast } = useToast();
  const { data, loading } = useFetch(() => api.get<SiteSettings>('/admin/settings'), []);
  const { data: media } = useFetch(() => api.get<MediaItem[]>('/admin/media'), []);
  const [s, setS] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (data) setS(data);
  }, [data]);

  if (loading || !s) return <Spinner />;
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setS({ ...s, [k]: v });
  const text = (k: keyof SiteSettings, label: string, hint?: string, placeholder?: string) => (
    <Field label={label} hint={hint}>
      <Input value={String(s[k] ?? '')} onChange={(e) => set(k, e.target.value as any)} placeholder={placeholder} />
    </Field>
  );
  const area = (k: keyof SiteSettings, label: string, hint?: string, rows = 4) => (
    <Field label={label} hint={hint}>
      <Textarea rows={rows} value={String(s[k] ?? '')} onChange={(e) => set(k, e.target.value as any)} />
    </Field>
  );

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      setS(await api.put<SiteSettings>('/admin/settings', s));
      await refresh();
      toast('Settings saved — changes are live');
    } catch (x: any) {
      setError(x.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Site settings</h1>
          <p className="text-sm text-zinc-400">Everything here updates the live site as soon as you save.</p>
        </div>
        <Button type="submit" loading={saving}>Save settings</Button>
      </div>
      {error && <Alert>{error}</Alert>}

      <Section title="General">
        {text('siteName', 'Site name', 'Shown in the header, browser tab and emails.')}
        {text('tagline', 'Tagline')}
        {text('contactEmail', 'Contact email', 'Shown in the footer and legal pages.', 'hello@yoursite.com')}
        {text('footerText', 'Footer text', 'Leave blank for “© year Site name”.')}
      </Section>

      <Section title="Homepage" description="The big spotlight at the top of the homepage.">
        <Field label="Featured video" hint="Leave on “Newest video” to always feature the latest upload. You can also use the ★ button in Videos.">
          <Select value={s.featuredMediaId || ''} onChange={(e) => set('featuredMediaId', e.target.value || null)}>
            <option value="">Newest video</option>
            {(media || []).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </Select>
        </Field>
        {text('heroHeadline', 'Spotlight headline', "Leave blank to use the video's title.")}
        {area('heroSubtext', 'Spotlight text', "Leave blank to use the video's description.", 2)}
      </Section>

      <Section title="Announcement bar" description="A strip across the top of every page. Leave blank to hide it.">
        {text('announcementBanner', 'Announcement message', undefined, 'e.g. New drops every Friday!')}
        {text('announcementLink', 'Link (optional)', 'A page like /events or a full https:// address.')}
      </Section>

      <Section title="Access">
        <Toggle label="Maintenance mode" hint="Visitors see a “back soon” page. Admins can still use the whole site." checked={s.maintenanceMode} onChange={(v) => set('maintenanceMode', v)} />
        {area('maintenanceMessage', 'Maintenance message', undefined, 2)}
        <Toggle label="Allow new sign-ups" checked={s.allowRegistration} onChange={(v) => set('allowRegistration', v)} />
        <Toggle label="18+ age confirmation" hint="Strongly recommended for adult content." checked={s.ageGateEnabled} onChange={(v) => set('ageGateEnabled', v)} />
        {area('ageGateMessage', 'Age confirmation text', undefined, 3)}
      </Section>

      <Section title="Search engines" description="How the site appears in Google and when shared.">
        {text('metaTitle', 'Page title', 'Leave blank to use the site name.')}
        {area('metaDescription', 'Description', undefined, 2)}
      </Section>

      <Section title="Ads">
        <Toggle label="Show ads" hint="Master switch for every ad placement." checked={s.adsEnabled} onChange={(v) => set('adsEnabled', v)} />
        {text('adsenseClientId', 'Google AdSense client ID', 'Needed for AdSense ads. Visitors are asked for cookie consent first.', 'ca-pub-…')}
        {area('adsTxtContent', 'ads.txt', 'Served at /ads.txt for ad networks.', 3)}
      </Section>

      <Section title="Legal pages" description="Leave blank to show the built-in default text.">
        {area('privacyPolicy', 'Privacy policy', undefined, 8)}
        {area('termsOfService', 'Terms of service', undefined, 8)}
      </Section>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>Save settings</Button>
      </div>
    </form>
  );
}
