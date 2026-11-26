import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Role, User } from '../../shared/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePageTitle } from '../lib/settings';
import { timeAgo, useFetch } from '../lib/utils';
import { Alert, Button, Field, Input, Modal, Select, Spinner, Toggle, cx, useToast } from '../components/ui';

type AdminUser = User & { disabled?: boolean };
const ROLES: { value: Role; label: string }[] = [
  { value: 'CONSUMER', label: 'Viewer' },
  { value: 'CREATOR', label: 'Creator' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'ADMIN', label: 'Admin' },
];
const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label || r;

export default function UsersAdmin() {
  usePageTitle('Admin · Users');
  const { user: me } = useAuth();
  const { toast, confirm } = useToast();
  const { data, loading, error, reload } = useFetch(() => api.get<AdminUser[]>('/admin/users'), []);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data || [])
      .filter((u) => (!role || u.role === role) && (!s || `${u.name} ${u.email} ${u.username}`.toLowerCase().includes(s)))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [data, q, role]);

  const open = (u: AdminUser | null) => {
    setEditing(u);
    setCreating(!u);
    setFormError('');
    setDraft(u ? { name: u.name, email: u.email, role: u.role, verified: u.verified, disabled: !!u.disabled, password: '' } : { name: '', email: '', role: 'CONSUMER', verified: false, password: '' });
  };
  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const body = { ...draft };
      if (editing && !body.password) delete body.password;
      if (editing) await api.put(`/admin/users/${editing.id}`, body);
      else await api.post('/admin/users', body);
      toast(editing ? 'User updated' : 'User created');
      close();
      reload();
    } catch (x: any) {
      setFormError(x.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u: AdminUser) => {
    if (!(await confirm(`Delete ${u.name} (${u.email})? Their account will be removed permanently.`, { confirmLabel: 'Delete user' }))) return;
    try {
      await api.del(`/admin/users/${u.id}`);
      toast('User deleted');
      reload();
    } catch (x: any) {
      toast(x.message, 'error');
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-zinc-400">Change roles, verify, suspend or reset passwords.</p>
        </div>
        <Button onClick={() => open(null)}><Plus className="h-4 w-4" /> Add user</Button>
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="pl-9" aria-label="Search users" />
        </div>
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-44" aria-label="Filter by role">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>
      </div>
      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-900">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-900/70 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-900/40" data-testid="admin-row">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name} {u.id === me?.id && <span className="text-xs text-zinc-500">(you)</span>}</p>
                    <p className="text-xs text-zinc-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cx('rounded-full px-2 py-0.5 text-xs', u.role === 'ADMIN' ? 'bg-brand-500/15 text-brand-300' : 'bg-zinc-800 text-zinc-300')}>{roleLabel(u.role)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.disabled ? <span className="text-red-400">Suspended</span> : u.verified ? <span className="text-emerald-400">Verified</span> : <span className="text-zinc-500">Active</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{timeAgo(u.createdAt) || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="px-2.5" onClick={() => open(u)} aria-label="Edit user"><Pencil className="h-4 w-4" /></Button>
                      {u.id !== me?.id && (
                        <Button variant="ghost" className="px-2.5 hover:text-red-400" onClick={() => remove(u)} aria-label="Delete user"><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-600">{rows.length} of {data?.length || 0}</p>

      <Modal open={creating || !!editing} onClose={close} title={editing ? `Edit ${editing.name}` : 'Add user'}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Name"><Input value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></Field>
          <Field label="Email"><Input type="email" value={draft.email || ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required /></Field>
          <Field label="Role">
            <Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} disabled={editing?.id === me?.id}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </Field>
          <Field
            label={editing ? 'Set a new password (optional)' : 'Password'}
            hint="8+ characters with upper & lower case, a number and a symbol. Setting it signs the user out everywhere."
          >
            <Input type="text" value={draft.password || ''} onChange={(e) => setDraft({ ...draft, password: e.target.value })} required={!editing} autoComplete="new-password" />
          </Field>
          <Toggle label="Verified" hint="Shows a verified badge." checked={!!draft.verified} onChange={(v) => setDraft({ ...draft, verified: v })} />
          {editing && editing.id !== me?.id && (
            <Toggle label="Suspended" hint="Blocks sign-in and signs them out." checked={!!draft.disabled} onChange={(v) => setDraft({ ...draft, disabled: v })} />
          )}
          {formError && <Alert>{formError}</Alert>}
          <div className="flex justify-end gap-2 border-t border-zinc-900 pt-4">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Create user'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
