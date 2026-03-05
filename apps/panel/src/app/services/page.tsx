'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import {
  servicesApi,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_COLORS,
  INTERVAL_OPTIONS,
  type ServiceRecord,
  type ServiceWithSecret,
  type CreateServicePayload,
} from '@/lib/services-api';

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceType = 'api_nestjs' | 'api_laravel' | 'web_nextjs';

const SERVICE_TYPES: ServiceType[] = ['api_nestjs', 'api_laravel', 'web_nextjs'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const label = SERVICE_TYPE_LABELS[type as ServiceType] ?? type;
  const color = SERVICE_TYPE_COLORS[type as ServiceType] ?? '#9CA3AF';
  return (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-xs font-medium"
      style={{ color, backgroundColor: `${color}1A` }}
    >
      {label}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        'rounded px-1.5 py-0.5 font-mono text-xs',
        active ? 'bg-status-up/10 text-status-up' : 'bg-white/5 text-text-muted',
      ].join(' ')}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="ml-2 shrink-0 rounded px-2 py-1 font-mono text-xs transition-colors"
      style={{ backgroundColor: 'rgba(200,169,81,0.1)', color: '#C8A951' }}
    >
      {copied ? '✓ Copied' : label ?? 'Copy'}
    </button>
  );
}

// ─── Credentials Modal ────────────────────────────────────────────────────────

function CredentialsModal({
  service,
  onClose,
}: {
  service: ServiceWithSecret;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-lg rounded-2xl border p-6"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(200,169,81,0.3)' }}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="text-accent text-lg">⚠</span>
          <h2 className="text-base font-semibold text-text-primary">Service credentials</h2>
        </div>
        <p className="mb-6 text-sm text-status-down font-medium">
          Save these credentials now — the secret will never be shown again.
        </p>

        <div className="space-y-4">
          <div>
            <p className="mb-1 font-mono text-xs text-text-muted uppercase tracking-wider">API Key</p>
            <div className="flex items-center rounded-lg p-3" style={{ backgroundColor: '#0A0F1A' }}>
              <code className="flex-1 break-all font-mono text-xs text-accent">{service.monitorApiKey}</code>
              <CopyButton value={service.monitorApiKey} />
            </div>
          </div>
          <div>
            <p className="mb-1 font-mono text-xs text-text-muted uppercase tracking-wider">Secret</p>
            <div className="flex items-center rounded-lg p-3" style={{ backgroundColor: '#0A0F1A' }}>
              <code className="flex-1 break-all font-mono text-xs text-accent-tech">{service.monitorSecret}</code>
              <CopyButton value={service.monitorSecret} />
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-text-muted">
          Use these credentials in your monitor agent to authenticate requests via HMAC-SHA256.
        </p>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold transition-colors"
          style={{ backgroundColor: '#C8A951', color: '#0A0F1A' }}
        >
          I have saved my credentials
        </button>
      </div>
    </div>
  );
}

// ─── Service Form Modal ───────────────────────────────────────────────────────

interface ServiceFormData {
  name: string;
  url: string;
  type: ServiceType;
  healthEndpoint: string;
  logsEndpoint: string;
  checkIntervalSeconds: number;
  isActive: boolean;
  alertsEnabled: boolean;
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
};

function ServiceFormModal({
  initial,
  title,
  onSubmit,
  onClose,
  busy,
}: {
  initial?: ServiceRecord;
  title: string;
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
        }
      : defaultForm
  );

  const field = (key: keyof ServiceFormData, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const inputClass =
    'w-full rounded-lg border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors';
  const inputStyle = { backgroundColor: '#0A0F1A', borderColor: 'rgba(255,255,255,0.12)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-lg rounded-2xl border p-6 my-4"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">✕</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label className="mb-1 block font-mono text-xs text-text-muted uppercase tracking-wider">Type *</label>
              <select
                className={inputClass}
                style={inputStyle}
                value={form.type}
                onChange={(e) => field('type', e.target.value)}
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-mono text-xs text-text-muted uppercase tracking-wider">Check interval</label>
              <select
                className={inputClass}
                style={inputStyle}
                value={form.checkIntervalSeconds}
                onChange={(e) => field('checkIntervalSeconds', Number(e.target.value))}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

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
          </div>

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
            {busy ? 'Saving…' : 'Save service'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({
  service,
  onConfirm,
  onClose,
  busy,
}: {
  service: ServiceRecord;
  onConfirm: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-sm rounded-2xl border p-6"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(239,68,68,0.3)' }}
      >
        <h2 className="mb-2 text-base font-semibold text-text-primary">Delete service</h2>
        <p className="mb-6 text-sm text-text-muted">
          Delete <span className="font-semibold text-text-primary">{service.name}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#EF4444', color: '#fff' }}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Modal =
  | { type: 'create' }
  | { type: 'edit'; service: ServiceRecord }
  | { type: 'delete'; service: ServiceRecord }
  | { type: 'credentials'; service: ServiceWithSecret };

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    servicesApi
      .list()
      .then((res) => setServices(res.data))
      .catch(() => setError('Failed to load services'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (form: ServiceFormData) => {
    setBusy(true);
    try {
      const payload: CreateServicePayload = {
        ...form,
        ...(form.healthEndpoint ? { healthEndpoint: form.healthEndpoint } : {}),
        ...(form.logsEndpoint ? { logsEndpoint: form.logsEndpoint } : {}),
      };
      const result = await servicesApi.create(payload);
      setModal({ type: 'credentials', service: result });
      load();
    } catch {
      setError('Failed to create service');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (form: ServiceFormData) => {
    if (modal?.type !== 'edit') return;
    setBusy(true);
    try {
      await servicesApi.update(modal.service.id, form);
      setModal(null);
      load();
    } catch {
      setError('Failed to update service');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (modal?.type !== 'delete') return;
    setBusy(true);
    try {
      await servicesApi.delete(modal.service.id);
      setModal(null);
      load();
    } catch {
      setError('Failed to delete service');
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async (service: ServiceRecord) => {
    setBusy(true);
    try {
      const result = await servicesApi.regenerateKeys(service.id);
      setModal({ type: 'credentials', service: result });
    } catch {
      setError('Failed to regenerate keys');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell
      title="Services"
      subtitle="Manage monitored services and credentials"
      actions={
        <button
          onClick={() => setModal({ type: 'create' })}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{ backgroundColor: '#C8A951', color: '#0A0F1A' }}
        >
          + Add service
        </button>
      }
    >
      {error && (
        <div
          className="mb-6 flex items-center justify-between rounded-lg border px-4 py-3"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}
        >
          <span className="text-sm text-status-down">{error}</span>
          <button onClick={() => setError(null)} className="text-sm text-text-muted hover:text-text-primary">✕</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl border"
              style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
            />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="mb-2 text-base font-semibold text-text-primary">No services yet</p>
          <p className="mb-6 text-sm text-text-muted">Add your first service to start monitoring</p>
          <button
            onClick={() => setModal({ type: 'create' })}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: '#C8A951', color: '#0A0F1A' }}
          >
            Add service
          </button>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#111827' }}>
                {['Name', 'URL', 'Type', 'Interval', 'Status', 'Alerts', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-mono text-xs text-text-muted uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((s, idx) => (
                <tr
                  key={s.id}
                  style={{
                    backgroundColor: idx % 2 === 0 ? '#0A0F1A' : '#111827',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <td className="px-4 py-3 font-medium text-text-primary">{s.name}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-text-muted">{s.url}</td>
                  <td className="px-4 py-3"><TypeBadge type={s.type} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{s.checkIntervalSeconds}s</td>
                  <td className="px-4 py-3"><ActiveBadge active={s.isActive} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{s.alertsEnabled ? '🔔 On' : '🔕 Off'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setModal({ type: 'edit', service: s })}
                        className="font-mono text-xs text-text-muted hover:text-accent transition-colors"
                      >
                        Edit
                      </button>
                      <span className="text-text-muted/30">|</span>
                      <button
                        onClick={() => handleRegenerate(s)}
                        disabled={busy}
                        className="font-mono text-xs text-text-muted hover:text-accent-tech transition-colors disabled:opacity-40"
                      >
                        Regen keys
                      </button>
                      <span className="text-text-muted/30">|</span>
                      <button
                        onClick={() => setModal({ type: 'delete', service: s })}
                        className="font-mono text-xs text-text-muted hover:text-status-down transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'create' && (
        <ServiceFormModal
          title="Add service"
          onSubmit={handleCreate}
          onClose={() => setModal(null)}
          busy={busy}
        />
      )}
      {modal?.type === 'edit' && (
        <ServiceFormModal
          title="Edit service"
          initial={modal.service}
          onSubmit={handleEdit}
          onClose={() => setModal(null)}
          busy={busy}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal
          service={modal.service}
          onConfirm={handleDelete}
          onClose={() => setModal(null)}
          busy={busy}
        />
      )}
      {modal?.type === 'credentials' && (
        <CredentialsModal
          service={modal.service}
          onClose={() => setModal(null)}
        />
      )}
    </DashboardShell>
  );
}
