'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard-shell';
import { servicesApi, SERVICE_TYPE_LABELS, SERVICE_TYPE_COLORS, type ServiceRecord } from '@/lib/services-api';

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'health-checks' | 'incidents' | 'logs';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'health-checks', label: 'Health Checks' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'logs', label: 'Logs' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-start justify-between border-b py-3"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <span className="font-mono text-xs text-text-muted uppercase tracking-wider">{label}</span>
      <span className="text-right text-sm text-text-primary font-medium">{value}</span>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const label = SERVICE_TYPE_LABELS[type] ?? type;
  const color = SERVICE_TYPE_COLORS[type] ?? '#9CA3AF';
  return (
    <span
      className="rounded px-2 py-0.5 font-mono text-xs font-medium"
      style={{ color, backgroundColor: `${color}1A` }}
    >
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: 'up' | 'down' | 'degraded' | 'unknown' }) {
  const colorMap = { up: '#22C55E', down: '#EF4444', degraded: '#F59E0B', unknown: '#6B7280' };
  const labelMap = { up: 'UP', down: 'DOWN', degraded: 'DEGRADED', unknown: 'UNKNOWN' };
  const color = colorMap[status];
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: status !== 'unknown' ? `0 0 6px ${color}` : 'none' }}
      />
      <span className="font-mono text-xs font-medium" style={{ color }}>{labelMap[status]}</span>
    </span>
  );
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function OverviewTab({ service }: { service: ServiceRecord }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Main config */}
      <div
        className="rounded-xl border p-6"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Configuration</h3>
        <DetailRow label="Name" value={service.name} />
        <DetailRow label="URL" value={<a href={service.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors underline underline-offset-2">{service.url}</a>} />
        <DetailRow label="Type" value={<TypeBadge type={service.type} />} />
        <DetailRow label="Check interval" value={`${service.checkIntervalSeconds}s`} />
        <DetailRow label="Status" value={<span className={service.isActive ? 'text-status-up' : 'text-text-muted'}>{service.isActive ? 'Active' : 'Inactive'}</span>} />
        <DetailRow label="Alerts" value={service.alertsEnabled ? '🔔 Enabled' : '🔕 Disabled'} />
        <DetailRow label="Created" value={new Date(service.createdAt).toLocaleString()} />
      </div>

      {/* Endpoints */}
      <div
        className="rounded-xl border p-6"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Endpoints</h3>
        <DetailRow
          label="Health endpoint"
          value={service.healthEndpoint ? (
            <code className="font-mono text-xs text-accent-tech">{service.healthEndpoint}</code>
          ) : (
            <span className="text-text-muted italic">Not set</span>
          )}
        />
        <DetailRow
          label="Logs endpoint"
          value={service.logsEndpoint ? (
            <code className="font-mono text-xs text-accent-tech">{service.logsEndpoint}</code>
          ) : (
            <span className="text-text-muted italic">Not set</span>
          )}
        />

        {/* API Key (partial mask) */}
        <div
          className="mt-6 rounded-lg p-4"
          style={{ backgroundColor: '#0A0F1A', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="mb-2 font-mono text-xs text-text-muted uppercase tracking-wider">API Key (read-only)</p>
          <code className="block break-all font-mono text-xs text-accent">
            {service.monitorApiKey.slice(0, 8)}••••••••••••••••••••{service.monitorApiKey.slice(-4)}
          </code>
          <p className="mt-2 text-xs text-text-muted">
            Use <strong className="text-text-primary">Services → Regen keys</strong> to rotate credentials.
          </p>
        </div>
      </div>

      {/* Current status */}
      <div
        className="rounded-xl border p-6 lg:col-span-2"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <h3 className="mb-4 text-sm font-semibold text-text-primary">Current status</h3>
        <div className="flex items-center gap-6">
          <StatusDot status="unknown" />
          <span className="text-sm text-text-muted">No health check data yet — checks will appear here once your monitor agent is running.</span>
        </div>
      </div>
    </div>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border py-24"
      style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
    >
      <p className="text-base font-semibold text-text-primary">{label}</p>
      <p className="mt-2 text-sm text-text-muted">Available in Phase 3 — health check engine</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [service, setService] = useState<ServiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    servicesApi
      .get(Number(id))
      .then(setService)
      .catch(() => setService(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardShell title="Loading…" subtitle="">
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl border" style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }} />
          ))}
        </div>
      </DashboardShell>
    );
  }

  if (!service) {
    return (
      <DashboardShell title="Service not found" subtitle="">
        <div className="flex flex-col items-center justify-center py-24">
          <p className="mb-4 text-base text-text-muted">The requested service could not be found.</p>
          <Link href="/services" className="text-sm text-accent hover:underline">← Back to services</Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={service.name}
      subtitle={service.url}
      actions={
        <Link
          href="/services"
          className="rounded-lg border px-4 py-2 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
          style={{ borderColor: 'rgba(255,255,255,0.12)' }}
        >
          ← Services
        </Link>
      }
    >
      {/* Tabs */}
      <div
        className="mb-6 flex gap-1 rounded-xl p-1"
        style={{ backgroundColor: '#111827' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150"
            style={
              activeTab === tab.id
                ? { backgroundColor: '#0A0F1A', color: '#C8A951', boxShadow: '0 0 0 1px rgba(200,169,81,0.3)' }
                : { color: '#9CA3AF' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab service={service} />}
      {activeTab === 'health-checks' && <PlaceholderTab label="Health Checks" />}
      {activeTab === 'incidents' && <PlaceholderTab label="Incidents" />}
      {activeTab === 'logs' && <PlaceholderTab label="Logs" />}
    </DashboardShell>
  );
}
