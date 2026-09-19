import React, { useState } from 'react';
import { Edit3, Trash2, X, CheckSquare } from 'lucide-react';

export interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onEdit: () => void;
  onDelete: () => void;
  accentLabel?: string;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  count,
  onClear,
  onEdit,
  onDelete,
  accentLabel,
}) => {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
      <div className="bg-zinc-950 border border-yellow-500/30 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.9)] px-5 py-3 flex items-center space-x-4 backdrop-blur-lg">
        <div className="flex items-center space-x-2 pr-4 border-r border-zinc-800">
          <CheckSquare className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-bold text-white">
            {count} selected{accentLabel ? <span className="ml-1 text-zinc-500">· {accentLabel}</span> : null}
          </span>
        </div>
        <button type="button" onClick={onEdit} className="flex items-center text-sm font-semibold text-zinc-200 hover:text-yellow-400 transition-colors">
          <Edit3 className="w-4 h-4 mr-1.5" /> Edit
        </button>
        <button type="button" onClick={onDelete} className="flex items-center text-sm font-semibold text-red-400 hover:text-red-300 transition-colors">
          <Trash2 className="w-4 h-4 mr-1.5" /> Delete
        </button>
        <button type="button" onClick={onClear} className="text-zinc-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export interface BulkEditModalProps {
  isOpen: boolean;
  count: number;
  onClose: () => void;
  onSubmit: (updates: Record<string, any>) => Promise<void>;
  entityType: 'media' | 'users' | 'talent';
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  count,
  onClose,
  onSubmit,
  entityType,
}) => {
  const [fields, setFields] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const fieldOptions = {
    media: [
      { key: 'creatorName', label: 'Creator Name', type: 'text' },
      { key: 'isPremium', label: 'Premium', type: 'bool' },
      { key: 'price', label: 'Price (ZAR)', type: 'number' },
      { key: 'tags', label: 'Tags (comma)', type: 'csv' },
      { key: 'mediaType', label: 'Media Type', type: 'select', options: ['video', 'image'] },
    ],
    users: [
      { key: 'verified', label: 'Verified', type: 'bool' },
      { key: 'role', label: 'Role', type: 'select', options: ['CONSUMER', 'CREATOR', 'PROFESSIONAL', 'ADMIN'] },
    ],
    talent: [
      { key: 'verified', label: 'Verified', type: 'bool' },
      { key: 'online', label: 'Online', type: 'bool' },
      { key: 'availability', label: 'Availability', type: 'select', options: ['Available Now', 'This Week', 'Booked'] },
      { key: 'hourlyRate', label: 'Hourly Rate (ZAR)', type: 'number' },
    ],
  } as const;

  const fieldsForEntity = fieldOptions[entityType];

  const toggleField = (key: string) => {
    setFields((prev) => {
      const next = { ...prev };
      if (key in next) delete next[key];
      else next[key] = '';
      return next;
    });
  };

  const setValue = (key: string, value: any) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (k === 'tags' && typeof v === 'string') {
        clean[k] = v.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (k === 'price' || k === 'hourlyRate') {
        if (v !== '' && v !== undefined) clean[k] = Number(v);
      } else {
        clean[k] = v;
      }
    }
    if (Object.keys(clean).length === 0) {
      alert('Select at least one field to edit');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(clean);
      setFields({});
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-black/50">
          <div>
            <h3 className="text-lg font-bold text-white">Bulk Edit</h3>
            <p className="text-xs text-zinc-500">Applying to {count} item{count === 1 ? '' : 's'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          <p className="text-xs text-zinc-400 mb-2">Check the fields you want to update in bulk:</p>
          {fieldsForEntity.map((field) => {
            const isEnabled = field.key in fields;
            return (
              <div key={field.key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => toggleField(field.key)}
                    className="w-4 h-4 accent-yellow-500 rounded"
                  />
                  <span className="text-sm font-semibold text-white">{field.label}</span>
                </label>

                {isEnabled && (
                  <div className="pl-7">
                    {field.type === 'bool' ? (
                      <select
                        value={fields[field.key] ? 'true' : 'false'}
                        onChange={(e) => setValue(field.key, e.target.value === 'true')}
                        className="w-full bg-black border border-zinc-800 text-sm text-white rounded-lg px-3 py-2"
                      >
                        <option value="true">True / Yes</option>
                        <option value="false">False / No</option>
                      </select>
                    ) : field.type === 'select' ? (
                      <select
                        value={fields[field.key]}
                        onChange={(e) => setValue(field.key, e.target.value)}
                        className="w-full bg-black border border-zinc-800 text-sm text-white rounded-lg px-3 py-2"
                      >
                        <option value="">-- Select --</option>
                        {field.options.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={fields[field.key]}
                        onChange={(e) => setValue(field.key, e.target.value)}
                        placeholder={`Enter new ${field.label.toLowerCase()}...`}
                        className="w-full bg-black border border-zinc-800 text-sm text-white rounded-lg px-3 py-2"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-zinc-800 flex justify-end space-x-3 bg-zinc-950">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Apply Updates'}
          </button>
        </div>
      </div>
    </div>
  );
};
