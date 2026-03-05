'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { DashboardShell } from '@/components/dashboard-shell';
import { type ServiceRecord, SERVICE_TYPE_LABELS, SERVICE_TYPE_COLORS, servicesApi, type PaginatedServices } from '@/lib/services-api';
import { healthApi, type HealthCheckRecord, type PaginatedHealthChecks, servicePreviewUrl } from '@/lib/health-api';
import { useMonitorSocket, type WsHealthUpdate, type WsResourceWarning } from '@/lib/use-monitor-socket';

type ServiceStatus = 'up' | 'down' | 'degraded' | 'unknown';

function StatusDot({ status }: { status: ServiceStatus }) {
  const colorMap = {
    up: '#22C55E',
    down: '#EF4444',
    degraded: '#F59E0B',
    unknown: '#6B7280',
  };
  const labelMap = {
    up: 'UP',
    down: 'DOWN',
    degraded: 'DEGRADED',
    unknown: '—',
  };
  const color = colorMap[status];
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color, boxShadow: status !== 'unknown' ? `0 0 6px ${color}` : 'none' }}
      />
      <span className="font-mono text-xs" style={{ color }}>{labelMap[status]}</span>
    </span>
  );
}

function ServiceCard({ service, latestCheck }: { service: ServiceRecord; latestCheck?: HealthCheckRecord | null | undefined }) {
  const typeLabel = SERVICE_TYPE_LABELS[service.type as keyof typeof SERVICE_TYPE_LABELS] ?? service.type;
  const typeColor = SERVICE_TYPE_COLORS[service.type as keyof typeof SERVICE_TYPE_COLORS] ?? '#9CA3AF';
  const status: ServiceStatus = (latestCheck?.status as ServiceStatus) ?? 'unknown';
  const statusLabel = status === 'unknown' ? 'Pending check' : `${latestCheck?.responseTimeMs ?? '—'}ms`;

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
            <StatusDot status={status} />
            <span className="font-mono text-xs text-text-muted">{statusLabel}</span>
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

        {/* Preview thumbnail */}
        <ServicePreviewThumb serviceId={service.id} />

        {/* Resource bars */}
        {(() => {
          const rd = latestCheck?.responseData;
          const disk = rd?.['disk'] as { used_percent?: number } | undefined;
          const mem = rd?.['memory'] as { used_percent?: number } | undefined;
          if (!disk && !mem) return null;
          const barColor = (pct: number) =>
            pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#22C55E';
          return (
            <div className="mt-3 flex flex-col gap-1.5">
              {disk?.used_percent != null && (
                <div className="flex items-center gap-2">
                  <span className="w-12 text-[10px] text-text-muted font-mono">Disk</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(disk.used_percent, 100)}%`, backgroundColor: barColor(disk.used_percent) }}
                    />
                  </div>
                  <span className="w-10 text-right text-[10px] font-mono" style={{ color: barColor(disk.used_percent) }}>
                    {disk.used_percent.toFixed(0)}%
                  </span>
                </div>
              )}
              {mem?.used_percent != null && (
                <div className="flex items-center gap-2">
                  <span className="w-12 text-[10px] text-text-muted font-mono">Mem</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(mem.used_percent, 100)}%`, backgroundColor: barColor(mem.used_percent) }}
                    />
                  </div>
                  <span className="w-10 text-right text-[10px] font-mono" style={{ color: barColor(mem.used_percent) }}>
                    {mem.used_percent.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          );
        })()}

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

function ServicePreviewThumb({ serviceId }: { serviceId: number }) {
  const [hasPreview, setHasPreview] = useState(false);
  const src = servicePreviewUrl(serviceId);

  useEffect(() => {
    fetch(src, { method: 'HEAD' })
      .then((res) => setHasPreview(res.ok))
      .catch(() => setHasPreview(false));
  }, [src]);

  if (!hasPreview) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Service preview"
        className="h-24 w-full object-cover object-top"
        loading="lazy"
      />
    </div>
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
  // Map serviceId → latest HealthCheckRecord
  const [statusMap, setStatusMap] = useState<Record<number, HealthCheckRecord>>({});
  // Resource warnings received via WebSocket
  const [resourceWarnings, setResourceWarnings] = useState<WsResourceWarning[]>([]);

  // Load services
  useEffect(() => {
    servicesApi.list()
      .then((res: PaginatedServices) => setServices(res.data))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  // Load latest check for each service
  useEffect(() => {
    if (services.length === 0) return;
    const promises = services.map((s) =>
      healthApi.getChecks(s.id, 1, 1).then((res: PaginatedHealthChecks) => ({
        serviceId: s.id,
        check: res.data.length > 0 ? res.data[0]! : null,
      })).catch(() => ({ serviceId: s.id, check: null as HealthCheckRecord | null })),
    );

    Promise.all(promises).then((results) => {
      const map: Record<number, HealthCheckRecord> = {};
      for (const r of results) {
        if (r.check) {
          map[r.serviceId] = r.check;
        }
      }
      setStatusMap(map);
    });
  }, [services]);

  // WebSocket: real-time status updates
  const onHealthUpdate = useCallback((data: WsHealthUpdate) => {
    setStatusMap((prev) => ({
      ...prev,
      [data.serviceId]: {
        id: Date.now(),
        serviceId: data.serviceId,
        status: data.status as HealthCheckRecord['status'],
        responseTimeMs: data.responseTimeMs,
        statusCode: data.statusCode,
        errorMessage: null,
        checkedAt: data.checkedAt,
        responseData: data.responseData ?? null,
      },
    }));
  }, []);

  useMonitorSocket({
    onHealthUpdate,
    onServiceUpdate: useCallback(() => {
      // Reload services list when a service is updated
      servicesApi.list()
        .then((res: PaginatedServices) => setServices(res.data))
        .catch(() => { /* ignore */ });
    }, []),
    onResourceWarning: useCallback((data: WsResourceWarning) => {
      setResourceWarnings((prev) => {
        // Replace existing warning for same service, keep latest only
        const filtered = prev.filter((w) => w.serviceId !== data.serviceId);
        return [data, ...filtered].slice(0, 10); // max 10 warnings
      });
    }, []),
  });

  const activeCount = services.filter((s) => s.isActive).length;
  const upCount = Object.values(statusMap).filter((c) => c.status === 'up').length;
  const downCount = Object.values(statusMap).filter((c) => c.status === 'down').length;
  const degradedCount = Object.values(statusMap).filter((c) => c.status === 'degraded').length;

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
      {/* Resource warnings banner */}
      {resourceWarnings.length > 0 && (
        <div className="mb-6 space-y-2">
          {resourceWarnings.map((rw) => (
            <Link key={rw.serviceId} href={`/services/${rw.serviceId}`}>
              <div
                className="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm cursor-pointer hover:border-amber-400/40 transition-colors"
                style={{
                  backgroundColor: 'rgba(245,158,11,0.08)',
                  borderColor: 'rgba(245,158,11,0.25)',
                }}
              >
                <span className="mt-0.5 text-base">⚠️</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold" style={{ color: '#F59E0B' }}>
                    Resource Warning — {rw.serviceName}
                  </p>
                  {rw.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-text-muted mt-0.5">
                      {w.type === 'disk' ? '💾 Disk' : '🧠 Memory'}: <strong className="text-text-primary">{w.usedPercent.toFixed(1)}%</strong> used (threshold: {w.threshold}%) — {w.detail}
                    </p>
                  ))}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setResourceWarnings((prev) => prev.filter((w) => w.serviceId !== rw.serviceId));
                  }}
                  className="shrink-0 text-text-muted hover:text-text-primary transition-colors text-xs"
                  aria-label="Dismiss warning"
                >
                  ✕
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Stats */}
      {services.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Total', value: services.length, color: '#9CA3AF' },
            { label: 'Active', value: activeCount, color: '#60A5FA' },
            { label: 'Up', value: upCount, color: '#22C55E' },
            { label: 'Degraded', value: degradedCount, color: '#F59E0B' },
            { label: 'Down', value: downCount, color: '#EF4444' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border px-6 py-4"
              style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <p className="font-mono text-xs text-text-muted uppercase tracking-wider">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
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
            <ServiceCard key={s.id} service={s} latestCheck={statusMap[s.id]} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

