import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useSettings } from '../lib/settings';
import { Button } from './ui';

const KEY = 'ac_age_verified'; // same key as the previous site, so returning visitors aren't asked again

function alreadyVerified() {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export default function AgeGate() {
  const { settings, loaded } = useSettings();
  const [verified, setVerified] = useState(alreadyVerified);
  if (!loaded || verified || !settings.ageGateEnabled) return null;

  const enter = () => {
    try {
      localStorage.setItem(KEY, 'true');
    } catch {
      /* still let them in for this visit */
    }
    setVerified(true);
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center overflow-y-auto bg-black/95 p-4 backdrop-blur-xl">
      <div role="dialog" aria-modal="true" aria-labelledby="age-title" className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-7 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-brand-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 id="age-title" className="text-2xl font-bold">Adults only (18+)</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{settings.ageGateMessage}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button className="whitespace-nowrap sm:flex-[3]" onClick={enter}>I'm 18 or older, enter</Button>
          <Button variant="secondary" className="sm:flex-[2]" onClick={() => (window.location.href = 'https://www.google.com')}>
            Leave
          </Button>
        </div>
      </div>
    </div>
  );
}
