import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type Ref, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// --- Buttons ---

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-500 hover:bg-brand-400 text-zinc-950 font-semibold',
  secondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700',
  ghost: 'hover:bg-zinc-800 text-zinc-300 hover:text-white',
  danger: 'bg-red-600/90 hover:bg-red-500 text-white font-semibold',
};

export function Button({
  variant = 'primary', loading, className, children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// --- Form fields ---

const inputCls =
  'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40 disabled:opacity-60';

/**
 * A labelled form field. Use `group` when the field holds several controls
 * (e.g. a text box plus an Upload button) so buttons keep their own names.
 */
export function Field({ label, hint, error, children, className, group }: {
  label?: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string; group?: boolean;
}) {
  const title = label && <span className="block text-sm font-medium text-zinc-300">{label}</span>;
  const notes = (
    <>
      {hint && !error && <span className="block text-xs text-zinc-500">{hint}</span>}
      {error && <span role="alert" className="block text-xs text-red-400">{error}</span>}
    </>
  );
  if (group) {
    return (
      <div role="group" aria-label={label} className={cx('space-y-1.5', className)}>
        {title}
        {children}
        {notes}
      </div>
    );
  }
  // Only the title and the control live inside <label>, so hints don't become part of the field's name.
  return (
    <div className={cx('space-y-1.5', className)}>
      <label className="block space-y-1.5">
        {title}
        {children}
      </label>
      {notes}
    </div>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={4} {...p} className={cx(inputCls, 'resize-y', p.className)} />
);
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)} />;

export function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3.5">
      <span>
        <span className="block text-sm font-medium text-zinc-200">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400',
          checked ? 'bg-brand-500' : 'bg-zinc-700',
        )}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', checked ? 'left-5.5' : 'left-0.5')} />
      </span>
    </label>
  );
}

/** URL text box plus an "Upload" button that stores the image and fills in the URL. */
export function ImageInput({ value, onChange, placeholder, label }: { value: string; onChange: (url: string) => void; placeholder?: string; label?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || 'https://… or upload an image'} aria-label={label ? `${label} URL` : 'Image URL'} />
        <Button variant="secondary" loading={busy} onClick={() => fileRef.current?.click()} className="shrink-0">
          {!busy && <ImagePlus className="h-4 w-4" />} Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            setErr('');
            try {
              onChange(await api.upload(f));
            } catch (x: any) {
              setErr(x.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      {value && <img src={value} alt="" className="h-24 rounded-md border border-zinc-800 object-cover" />}
    </div>
  );
}

// --- Feedback ---

export const Spinner = ({ className }: { className?: string }) => (
  <div className={cx('flex justify-center py-16', className)}>
    <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
  </div>
);

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-14 text-center">
      {icon && <div className="mb-3 flex justify-center text-zinc-600">{icon}</div>}
      <p className="font-medium text-zinc-300">{title}</p>
      {children && <div className="mt-1 text-sm text-zinc-500">{children}</div>}
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-red-900/70 bg-red-950/50 text-red-200',
    success: 'border-emerald-900/70 bg-emerald-950/40 text-emerald-200',
    info: 'border-zinc-700 bg-zinc-900 text-zinc-300',
  }[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cx('flex gap-2.5 rounded-lg border p-3 text-sm', styles)}>
      {kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('my-8 w-full rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl animate-fade-in', wide ? 'max-w-3xl' : 'max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// --- Toasts & confirm ---

type Toast = { id: number; kind: 'success' | 'error'; text: string };
const ToastContext = createContext<{
  toast: (text: string, kind?: 'success' | 'error') => void;
  confirm: (message: string, opts?: { confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}>({ toast: () => {}, confirm: async () => false });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<{ message: string; confirmLabel: string; danger: boolean; resolve: (v: boolean) => void } | null>(null);

  const toast = useCallback((text: string, kind: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);

  const confirm = useCallback(
    (message: string, opts: { confirmLabel?: string; danger?: boolean } = {}) =>
      new Promise<boolean>((resolve) =>
        setPending({ message, confirmLabel: opts.confirmLabel || 'Confirm', danger: opts.danger ?? true, resolve }),
      ),
    [],
  );
  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-xl animate-fade-in',
              t.kind === 'success' ? 'border-emerald-800 bg-emerald-950 text-emerald-100' : 'border-red-800 bg-red-950 text-red-100',
            )}
          >
            {t.kind === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
      <Modal open={!!pending} onClose={() => close(false)} title="Are you sure?">
        <p className="text-sm text-zinc-300">{pending?.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
          <Button variant={pending?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{pending?.confirmLabel}</Button>
        </div>
      </Modal>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
