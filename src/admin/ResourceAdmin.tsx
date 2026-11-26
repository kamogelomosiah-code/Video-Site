import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/utils';
import { Alert, Button, Empty, Field, ImageInput, Input, Modal, Select, Spinner, Textarea, Toggle, useToast } from '../components/ui';

export type FieldDef =
  | { key: string; label: string; type: 'text' | 'url' | 'number' | 'date' | 'time'; hint?: ReactNode; required?: boolean; placeholder?: string; half?: boolean }
  | { key: string; label: string; type: 'textarea'; hint?: ReactNode; rows?: number }
  | { key: string; label: string; type: 'toggle'; hint?: string; /** Treat a missing value as ON (older records lack the field). */ defaultOn?: boolean }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; hint?: ReactNode; half?: boolean }
  | { key: string; label: string; type: 'image'; hint?: ReactNode }
  | { key: string; label: string; type: 'tags'; hint?: ReactNode }
  | { key: string; label: string; type: 'products' };

export interface Column<T> {
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  title: string;
  description?: string;
  endpoint: string; // e.g. "media" → /api/admin/media
  noun: string; // "video"
  columns: Column<T>[];
  fields: FieldDef[] | ((draft: any) => FieldDef[]);
  defaults: Record<string, any>;
  searchText: (row: T) => string;
  sort?: (a: T, b: T) => number;
  rowActions?: (row: T, reload: () => void) => ReactNode;
  toolbar?: ReactNode | ((reload: () => void) => ReactNode);
  /** Show row checkboxes; renders this bar when some rows are selected. */
  bulkBar?: (selectedIds: string[], done: () => void) => ReactNode;
}

function ProductsEditor({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
  const update = (i: number, patch: any) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-3">
      {value.map((p, i) => (
        <div key={p.id || i} className="space-y-2 rounded-lg border border-zinc-800 p-3">
          <div className="flex gap-2">
            <Input placeholder="Name" value={p.name || ''} onChange={(e) => update(i, { name: e.target.value })} aria-label="Product name" />
            <Input placeholder="Price" type="number" min={0} value={p.price ?? ''} onChange={(e) => update(i, { price: e.target.value })} className="w-28" aria-label="Product price" />
            <Button variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove product"><X className="h-4 w-4" /></Button>
          </div>
          <Input placeholder="Short description" value={p.description || ''} onChange={(e) => update(i, { description: e.target.value })} aria-label="Product description" />
          <Input placeholder="Link (https://…)" value={p.contactUrl || ''} onChange={(e) => update(i, { contactUrl: e.target.value })} aria-label="Product link" />
        </div>
      ))}
      <Button variant="secondary" onClick={() => onChange([...value, { name: '', price: 0, description: '', contactUrl: '' }])}>
        <Plus className="h-4 w-4" /> Add offering
      </Button>
    </div>
  );
}

export function FormFields({ fields, draft, set }: { fields: FieldDef[]; draft: any; set: (k: string, v: any) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const wide = !('half' in f && f.half);
        const cls = wide ? 'sm:col-span-2' : '';
        switch (f.type) {
          case 'toggle':
            return <div key={f.key} className={cls}><Toggle label={f.label} hint={f.hint} checked={f.defaultOn ? draft[f.key] !== false : !!draft[f.key]} onChange={(v) => set(f.key, v)} /></div>;
          case 'textarea':
            return (
              <Field key={f.key} label={f.label} hint={f.hint} className={cls}>
                <Textarea rows={f.rows || 4} value={draft[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
              </Field>
            );
          case 'select':
            return (
              <Field key={f.key} label={f.label} hint={f.hint} className={cls}>
                <Select value={draft[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
            );
          case 'image':
            return (
              <Field key={f.key} label={f.label} hint={f.hint} className={cls} group>
                <ImageInput value={draft[f.key] || ''} onChange={(v) => set(f.key, v)} label={f.label} />
              </Field>
            );
          case 'tags':
            return (
              <Field key={f.key} label={f.label} hint={f.hint || 'Separate with commas'} className={cls}>
                <Input
                  value={Array.isArray(draft[f.key]) ? draft[f.key].join(', ') : draft[f.key] || ''}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </Field>
            );
          case 'products':
            return (
              <Field key={f.key} label={f.label} className={cls} group>
                <ProductsEditor value={draft[f.key] || []} onChange={(v) => set(f.key, v)} />
              </Field>
            );
          default:
            return (
              <Field key={f.key} label={f.label + (f.required ? ' *' : '')} hint={f.hint} className={cls}>
                <Input
                  type={f.type === 'url' ? 'text' : f.type}
                  inputMode={f.type === 'url' ? 'url' : undefined}
                  value={draft[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                  required={f.required}
                  placeholder={f.placeholder}
                />
              </Field>
            );
        }
      })}
    </div>
  );
}

export default function ResourceAdmin<T extends { id: string }>(p: Props<T>) {
  const { toast, confirm } = useToast();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useFetch(() => api.get<T[]>(`/admin/${p.endpoint}`), [p.endpoint]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const bulkDone = () => {
    setSelected(new Set());
    reload();
  };

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (data || []).filter((r) => !s || p.searchText(r).toLowerCase().includes(s));
    return p.sort ? [...list].sort(p.sort) : list;
  }, [data, q, p]);

  const openEdit = (row: T) => {
    setEditing(row);
    setCreating(false);
    setDraft({ ...row });
    setFormError('');
  };
  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setDraft({ ...p.defaults });
    setFormError('');
  };
  const close = () => {
    setEditing(null);
    setCreating(false);
    if (params.get('edit')) {
      params.delete('edit');
      setParams(params, { replace: true });
    }
  };

  // Deep links: /admin/media?edit=<id> opens that item; ?new=1 opens a blank form.
  useEffect(() => {
    if (params.get('new')) {
      params.delete('new');
      setParams(params, { replace: true });
      openCreate();
      return;
    }
    const id = params.get('edit');
    if (!id || !data) return;
    const row = data.find((r) => r.id === id);
    if (row) openEdit(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, params]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editing) await api.put(`/admin/${p.endpoint}/${editing.id}`, draft);
      else await api.post(`/admin/${p.endpoint}`, draft);
      toast(editing ? `Saved ${p.noun}` : `Added ${p.noun}`);
      close();
      reload();
    } catch (x: any) {
      setFormError(x.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: any) => {
    if (!(await confirm(`Delete “${row.title || row.name}”? This can't be undone.`, { confirmLabel: 'Delete' }))) return;
    try {
      await api.del(`/admin/${p.endpoint}/${row.id}`);
      toast(`Deleted ${p.noun}`);
      reload();
    } catch (x: any) {
      toast(x.message, 'error');
    }
  };

  const fields = typeof p.fields === 'function' ? p.fields(draft) : p.fields;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{p.title}</h1>
          {p.description && <p className="text-sm text-zinc-400">{p.description}</p>}
        </div>
        <div className="flex gap-2">
          {typeof p.toolbar === 'function' ? p.toolbar(reload) : p.toolbar}
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add {p.noun}</Button>
        </div>
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${p.title.toLowerCase()}…`} className="pl-9" aria-label={`Search ${p.title}`} />
      </div>
      {p.bulkBar && selected.size > 0 && (
        <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/40 bg-zinc-950 p-3 shadow-lg lg:top-2" data-testid="bulk-bar">
          <span className="mr-2 text-sm font-medium">{selected.size} selected</span>
          {p.bulkBar([...selected], bulkDone)}
          <Button variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Spinner />
      ) : !rows.length ? (
        <Empty title={data?.length ? 'Nothing matches your search' : `No ${p.title.toLowerCase()} yet`}>
          {!data?.length && <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4" /> Add the first {p.noun}</Button>}
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-900">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-900/70 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                {p.bulkBar && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all shown"
                      className="accent-amber-500"
                      checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                    />
                  </th>
                )}
                {p.columns.map((c) => <th key={c.label} className={`px-4 py-3 font-medium ${c.className || ''}`}>{c.label}</th>)}
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {rows.map((row) => (
                <tr key={row.id} className={selected.has(row.id) ? 'bg-brand-500/5' : 'hover:bg-zinc-900/40'} data-testid="admin-row">
                  {p.bulkBar && (
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label="Select row" className="accent-amber-500" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} />
                    </td>
                  )}
                  {p.columns.map((c) => <td key={c.label} className={`px-4 py-3 align-middle ${c.className || ''}`}>{c.render(row)}</td>)}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {p.rowActions?.(row, reload)}
                      <Button variant="ghost" className="px-2.5" onClick={() => openEdit(row)} aria-label={`Edit ${p.noun}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" className="px-2.5 hover:text-red-400" onClick={() => remove(row)} aria-label={`Delete ${p.noun}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-600">{rows.length} of {data?.length || 0}</p>

      <Modal open={creating || !!editing} onClose={close} title={editing ? `Edit ${p.noun}` : `Add ${p.noun}`} wide>
        <form onSubmit={save} className="space-y-5">
          <FormFields fields={fields} draft={draft} set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} />
          {formError && <Alert>{formError}</Alert>}
          <div className="flex justify-end gap-2 border-t border-zinc-900 pt-4">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save changes' : `Add ${p.noun}`}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
