'use client';

import { useEffect, useState } from 'react';
import {
  SERVICE_TYPE_LABELS,
  INTERVAL_OPTIONS,
  type ServiceRecord,
} from '@/lib/services-api';
import { categoriesApi, type CategoryRecord } from '@/lib/categories-api';

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceType = 'api_nestjs' | 'api_laravel' | 'web_nextjs';
const SERVICE_TYPES: ServiceType[] = ['api_nestjs', 'api_laravel', 'web_nextjs'];

export interface ServiceFormData {
  name: string;
  url: string;
  type: ServiceType;
  healthEndpoint: string;
  logsEndpoint: string;
  checkIntervalSeconds: number;
  isActive: boolean;
  alertsEnabled: boolean;
  categoryId: number | null;
}

const defaultForm: ServiceFormData = {
  name: '',
  url: '',
  type: 'api_nestjs',
  healthEndpoint: '',
  logsEndpoint: '',
  checkIntervalSeconds: 60,
  isActive: true,
  alertsEnabled: true,
  categoryId: null,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ServiceFormModal({
  initial,
  title,
  submitLabel,
  onSubmit,
  onClose,
  busy,
}: {
  initial?: ServiceRecord;
  title: string;
  submitLabel?: string;
  onSubmit: (data: ServiceFormData) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<ServiceFormData>(
    initial
      ? {
          name: initial.name,
          url: initial.url,
          type: initial.type as ServiceType,
          healthEndpoint: initial.healthEndpoint ?? '',
          logsEndpoint: initial.logsEndpoint ?? '',
          checkIntervalSeconds: initial.checkIntervalSeconds,
          isActive: initial.isActive,
          alertsEnabled: initial.alertsEnabled,
          categoryId: initial.categoryId ?? null,
        }
      : defaultForm,
  );

  // Categories
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#C8A951');
  const [catBusy, setCatBusy] = useState(false);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => {});
  }, []);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setCatBusy(true);
    try {
      const created = await categoriesApi.create({ name: newCatName.trim(), color: newCatColor });
      setCategories((prev) => [...prev, created]);
      setForm((prev) => ({ ...prev, categoryId: created.id }));
      setNewCatName('');
      setShowNewCat(false);
    } catch {
      /* ignore */
    } finally {
      setCatBusy(false);
    }
  };

  const field = (key: keyof ServiceFormData, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const inputClass =
    'w-full rounded-lg border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors';
  const inputStyle = { backgroundColor: '#0A0F1A', borderColor: 'rgba(255,255,255,0.12)' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-6 my-4"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2">
              <label className="mb-1 block font-mono text-xs text-text-muted uppercase tracking-wider">Name *</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="My API"
                value={form.name}
                onChange={(e) => field('name', e.target.value)}
              />
            </div>

            {/* URL */}
            <div className="col-span-2">
              <label className="mb-1 block font-mono text-xs text-text-muted uppercase tracking-wider">URL *</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="https://api.example.com"
                value={form.url}
                onChange={(e) => field('url', e.target.value)}
              />
            </div>

            {/* Type */}
            <div>
              <label className="mb-1 block font-mono text-xs text-text-muted uppercase tracking-wider">Type *</label>
              <select
                className={inputClass}
                style={inputStyle}
                value={form.type}
                onChange={(e) => field('type', e.target.value)}
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SERVICE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {/* Check interval */}
            <div>
              <label className="mb-1 block font-mono text-xs text-text-muted uppercase tracking-wider">Check interval</label>
              <select
                className={inputClass}
                style={inputStyle}
                value={form.checkIntervalSeconds}
                onChange={(e) => field('checkIntervalSeconds', Number(e.target.value))}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Health endpoint */}
            <div>
              <label className="mb-1 block font-mono text-xs text-text-muted uppercase tracking-wider">Health endpoint</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="/health"
                value={form.healthEndpoint}
                onChange={(e) => field('healthEndpoint', e.target.value)}
              />
            </div>

            {/* Logs endpoint */}
            <div>
              <label className="mb-1 block font-mono text-xs text-text-muted uppercase tracking-wider">Logs endpoint</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="/logs"
                value={form.logsEndpoint}
                onChange={(e) => field('logsEndpoint', e.target.value)}
              />
            </div>

            {/* Category with inline creation */}
            <div className="col-span-2">
              <label className="mb-1 block font-mono text-xs text-text-muted uppercase tracking-wider">Category</label>
              <div className="flex items-center gap-2">
                <select
                  className={`${inputClass} flex-1`}
                  style={inputStyle}
                  value={form.categoryId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((prev) => ({ ...prev, categoryId: val ? Number(val) : null }));
                  }}
                >
                  <option value="" style={{ backgroundColor: '#0A0F1A' }}>
                    No category
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} style={{ backgroundColor: '#0A0F1A' }}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCat((v) => !v)}
                  className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: 'rgba(200,169,81,0.15)',
                    color: '#C8A951',
                    border: '1px solid rgba(200,169,81,0.3)',
                  }}
                >
                  {showNewCat ? '✕' : '+ New'}
                </button>
              </div>
              {showNewCat && (
                <div
                  className="mt-2 flex items-center gap-2 rounded-lg p-2"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <input
                    className={`${inputClass} flex-1`}
                    style={inputStyle}
                    placeholder="Category name"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleCreateCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={catBusy || !newCatName.trim()}
                    onClick={() => void handleCreateCategory()}
                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
                    style={{ backgroundColor: '#C8A951', color: '#0A0F1A' }}
                  >
                    {catBusy ? '…' : 'Add'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                className="accent-accent h-4 w-4"
                checked={form.isActive}
                onChange={(e) => field('isActive', e.target.checked)}
              />
              Active monitoring
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                className="accent-accent h-4 w-4"
                checked={form.alertsEnabled}
                onChange={(e) => field('alertsEnabled', e.target.checked)}
              />
              Alerts enabled
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
          >
            Cancel
          </button>
          <button
            disabled={busy || !form.name || !form.url}
            onClick={() => onSubmit(form)}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#C8A951', color: '#0A0F1A' }}
          >
            {busy ? 'Saving…' : submitLabel ?? 'Save service'}
          </button>
        </div>
      </div>
    </div>
  );
}
