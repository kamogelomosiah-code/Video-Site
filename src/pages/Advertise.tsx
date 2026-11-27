import { useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AD_SLOTS } from '../../shared/types';
import { api } from '../lib/api';
import { usePageTitle } from '../lib/settings';
import { Alert, Button, Field, Input, Textarea } from '../components/ui';

/** The page the "Advertise here" boxes lead to. */
export default function AdvertisePage() {
  usePageTitle('Advertise with us');
  const [v, setV] = useState({ name: '', email: '', company: '', website: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/advertise', v);
      setSent(true);
    } catch (x: any) {
      setError(x.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center" data-testid="advertise-sent">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
        <h1 className="mt-4 text-2xl font-bold">Thank you</h1>
        <p className="mt-2 text-zinc-400">We have your enquiry and will reply to {v.email} soon.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold">Advertise with us</h1>
      <p className="mt-2 text-zinc-400">Reach people who are searching for videos. Tell us about your business and which space you are interested in, and we will get back to you.</p>

      <ul className="mt-6 grid gap-2 sm:grid-cols-2" aria-label="Ad spaces">
        {AD_SLOTS.map((s) => (
          <li key={s.id} className="rounded-lg border border-zinc-900 bg-zinc-950 p-3 text-sm">
            <p className="font-medium">{s.label} <span className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">{s.size}</span></p>
            <p className="mt-0.5 text-xs text-zinc-500">{s.where}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name *"><Input value={v.name} onChange={set('name')} maxLength={100} required autoComplete="name" /></Field>
          <Field label="Email *"><Input type="email" value={v.email} onChange={set('email')} maxLength={255} required autoComplete="email" /></Field>
          <Field label="Company"><Input value={v.company} onChange={set('company')} maxLength={120} autoComplete="organization" /></Field>
          <Field label="Website"><Input value={v.website} onChange={set('website')} maxLength={200} placeholder="https://" inputMode="url" autoCapitalize="off" /></Field>
        </div>
        <Field label="What would you like to advertise? *">
          <Textarea rows={5} value={v.message} onChange={set('message')} maxLength={4000} required />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy}>Send enquiry</Button>
      </form>
    </div>
  );
}
