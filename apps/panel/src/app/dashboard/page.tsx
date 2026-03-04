'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { DashboardShell } from '@/components/dashboard-shell';
import { type ServiceRecord, SERVICE_TYPE_LABELS, SERVICE_TYPE_COLORS, servicesApi } from '@/lib/services-api';

function StatusDot({ status }: { status: 'up' | 'down' | 'degraded' | 'unknown' }) {
  const colorMap = {
    up: '#22C55E',
    down: '#EF4444',
    degraded: '#F59E0B',
    unknown: '#6B7280',
  };
  const color = colorMap[status];
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: color, boxShadow: status !== 'unknown' ? `0 0 6px ${color}` : 'none' }}
    />
  );
}

function ServiceCard({ service }: { service: ServiceRecord }) {
  const typeLabel = SERVICE_TYPE_LABELS[service.type] ?? service.type;
  const typeColor = SERVICE_TYPE_COLORS[service.type] ?? '#9CA3AF';

  return (
    <Link href={`/services/${service.id}`}>
      <div
        className="group relative rounded-xl border p-5 transition-all duration-200 hover:border-accent/30 cursor-pointer"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
              {service.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-text-muted">{service.url}</p>
          </div>
          <span
            className="shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-medium"
            style={{ color: typeColor, backgroundColor: `${typeColor}1A` }}
          >
            {typeLabel}
          </span>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusDot status="unknown" />
            <span className="font-mono text-xs text-text-muted">Pending check</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={[
                'rounded px-1.5 py-0.5 font-mono text-xs',
                service.isActive
                  ? 'bg-status-up/10 text-status-up'
                  : 'bg-white/5 text-text-muted',
              ].join(' ')}
            >
              {service.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          className="mt-4 flex items-center justify-between border-t pt-3 font-mono text-xs text-text-muted"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <span>Every {service.checkIntervalSeconds}s</span>
          <span className="flex items-center gap-1">
            {service.alertsEnabled ? '🔔' : '🔕'}
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      </div>
      <h3 className="mb-2 text-base font-semibold text-text-primary">No services yet</h3>
      <p className="mb-6 text-sm text-text-muted">Add your first service to start monitoring</p>
      <Link
        href="/services"
        className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        style={{ backgroundColor: '#C8A951', color: '#0A0F1A' }}
      >
        Add service
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    servicesApi.list()
      .then((res) => setServices(res.data))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = services.filter((s) => s.isActive).length;

  return (
    <DashboardShell
      title="Dashboard"
      subtitle="Real-time monitoring overview"
      actions={
        <Link
          href="/services"
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{ backgroundColor: '#C8A951', color: '#0A0F1A' }}
        >
          + Add service
        </Link>
      }
    >
      {/* Stats */}
      {services.length > 0 && (
        <div className="mb-8 grid grid-cols-3 gap-4">
          {[
            { label: 'Total Services', value: services.length },
            { label: 'Active', value: activeCount },
            { label: 'Inactive', value: services.length - activeCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border px-6 py-4"
              style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <p className="font-mono text-xs text-text-muted uppercase tracking-wider">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Services grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border"
              style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
            />
          ))}
        </div>
      ) : services.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

