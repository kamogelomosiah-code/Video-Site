import { checkPassword, type PasswordPolicyContext } from '../../shared/password';
import { cx } from './ui';

export default function PasswordStrength({ password, context }: { password: string; context?: PasswordPolicyContext }) {
  if (!password) return null;
  const { failures } = checkPassword(password, context);
  const score = 5 - Math.min(5, failures.length);
  const label = score >= 5 ? 'Strong' : score >= 3 ? 'Fair' : 'Weak';
  const color = score >= 5 ? 'bg-emerald-500' : score >= 3 ? 'bg-brand-500' : 'bg-red-500';
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Password strength</span>
        <span className={cx('font-semibold', score >= 5 ? 'text-emerald-400' : score >= 3 ? 'text-brand-400' : 'text-red-400')}>{label}</span>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={cx('h-1 flex-1 rounded-full', i < score ? color : 'bg-zinc-800')} />
        ))}
      </div>
      {failures.length > 0 && (
        <ul className="space-y-0.5 text-xs text-zinc-500">
          {failures.map((f) => <li key={f}>• {f}</li>)}
        </ul>
      )}
    </div>
  );
}
