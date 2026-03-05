'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard-shell';
import { servicesApi, SERVICE_TYPE_LABELS, SERVICE_TYPE_COLORS, type ServiceRecord } from '@/lib/services-api';
import { healthApi, type HealthCheckRecord, type IncidentRecord, type PaginatedHealthChecks, type PaginatedIncidents, screenshotUrl, servicePreviewUrl, captureServiceScreenshot } from '@/lib/health-api';
import { useMonitorSocket, type WsHealthUpdate, type WsIncidentNew, type WsIncidentResolved, type WsResourceWarning } from '@/lib/use-monitor-socket';
import { LogViewer } from '@/components/log-viewer';

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'health-checks' | 'incidents' | 'logs';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'health-checks', label: 'Health Checks' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'logs', label: 'Logs' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  up: '#22C55E',
  down: '#EF4444',
  degraded: '#F59E0B',
  unknown: '#6B7280',
};

const STATUS_LABEL: Record<string, string> = {
  up: 'UP',
  down: 'DOWN',
  degraded: 'DEGRADED',
  unknown: 'UNKNOWN',
};

function formatDuration(start: string, end: string | null): string {
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

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
  const label = SERVICE_TYPE_LABELS[type as keyof typeof SERVICE_TYPE_LABELS] ?? type;
  const color = SERVICE_TYPE_COLORS[type as keyof typeof SERVICE_TYPE_COLORS] ?? '#9CA3AF';
  return (
    <span
      className="rounded px-2 py-0.5 font-mono text-xs font-medium"
      style={{ color, backgroundColor: `${color}1A` }}
    >
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#6B7280';
  const label = STATUS_LABEL[status] ?? 'UNKNOWN';
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: status !== 'unknown' ? `0 0 6px ${color}` : 'none' }}
      />
      <span className="font-mono text-xs font-medium" style={{ color }}>{label}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#6B7280';
  const label = STATUS_LABEL[status] ?? 'UNKNOWN';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-xs font-medium"
      style={{ color, backgroundColor: `${color}1A` }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function OverviewTab({
  service,
  latestCheck,
  onCheckNow,
  checking,
}: {
  service: ServiceRecord;
  latestCheck: HealthCheckRecord | null;
  onCheckNow: () => void;
  checking: boolean;
}) {
  const currentStatus = latestCheck?.status ?? 'unknown';

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

      {/* Current status + Check Now */}
      <div
        className="rounded-xl border p-6 lg:col-span-2"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">Current status</h3>
          <button
            onClick={onCheckNow}
            disabled={checking}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-50"
            style={{ backgroundColor: '#C8A951', color: '#0A0F1A' }}
          >
            {checking ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking…
              </span>
            ) : (
              'Check Now'
            )}
          </button>
        </div>
        <div className="flex items-center gap-6">
          <StatusDot status={currentStatus} />
          {latestCheck ? (
            <div className="flex flex-wrap gap-4 text-sm text-text-muted">
              {latestCheck.responseTimeMs != null && (
                <span>Response: <strong className="text-text-primary">{latestCheck.responseTimeMs}ms</strong></span>
              )}
              {latestCheck.statusCode != null && (
                <span>HTTP <strong className="text-text-primary">{latestCheck.statusCode}</strong></span>
              )}
              <span>Last check: <strong className="text-text-primary">{new Date(latestCheck.checkedAt).toLocaleString()}</strong></span>
            </div>
          ) : (
            <span className="text-sm text-text-muted">No health check data yet — click &quot;Check Now&quot; or wait for auto-check.</span>
          )}
        </div>
      </div>

      {/* System info from responseData */}
      {latestCheck?.responseData && (() => {
        const data = latestCheck.responseData as Record<string, unknown>;
        const disk = data['disk'] as { total_gb?: number; free_gb?: number; used_gb?: number; used_percent?: number } | undefined;
        const memory = data['memory'] as { total_mb?: number; free_mb?: number; used_mb?: number; used_percent?: number } | undefined;
        const db = data['db'] as { connected?: boolean; type?: string } | undefined;
        const hasSystemInfo = disk || memory || db;

        if (!hasSystemInfo) return null;

        return (
          <div
            className="rounded-xl border p-6 lg:col-span-2"
            style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <h3 className="mb-4 text-sm font-semibold text-text-primary">System info</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Disk */}
              {disk && (
                <div className="rounded-lg p-4" style={{ backgroundColor: '#0A0F1A', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="mb-2 font-mono text-xs text-text-muted uppercase tracking-wider">Disk</p>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-text-muted mb-1">
                      <span>{disk.used_gb?.toFixed(1) ?? '–'} GB used</span>
                      <span>{disk.total_gb?.toFixed(1) ?? '–'} GB total</span>
                    </div>
                    <div className="h-2 w-full rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(disk.used_percent ?? 0, 100)}%`,
                          backgroundColor: (disk.used_percent ?? 0) > 90 ? '#EF4444' : (disk.used_percent ?? 0) > 75 ? '#F59E0B' : '#22C55E',
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-right text-xs font-medium" style={{ color: (disk.used_percent ?? 0) > 90 ? '#EF4444' : (disk.used_percent ?? 0) > 75 ? '#F59E0B' : '#22C55E' }}>
                    {disk.used_percent?.toFixed(1) ?? '–'}% used · {disk.free_gb?.toFixed(1) ?? '–'} GB free
                  </p>
                </div>
              )}

              {/* Memory */}
              {memory && (
                <div className="rounded-lg p-4" style={{ backgroundColor: '#0A0F1A', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="mb-2 font-mono text-xs text-text-muted uppercase tracking-wider">Memory</p>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-text-muted mb-1">
                      <span>{memory.used_mb?.toFixed(0) ?? '–'} MB used</span>
                      <span>{memory.total_mb?.toFixed(0) ?? '–'} MB total</span>
                    </div>
                    <div className="h-2 w-full rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(memory.used_percent ?? 0, 100)}%`,
                          backgroundColor: (memory.used_percent ?? 0) > 90 ? '#EF4444' : (memory.used_percent ?? 0) > 75 ? '#F59E0B' : '#22C55E',
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-right text-xs font-medium" style={{ color: (memory.used_percent ?? 0) > 90 ? '#EF4444' : (memory.used_percent ?? 0) > 75 ? '#F59E0B' : '#22C55E' }}>
                    {memory.used_percent?.toFixed(1) ?? '–'}% used · {memory.free_mb?.toFixed(0) ?? '–'} MB free
                  </p>
                </div>
              )}

              {/* Database */}
              {db && (
                <div className="rounded-lg p-4" style={{ backgroundColor: '#0A0F1A', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="mb-2 font-mono text-xs text-text-muted uppercase tracking-wider">Database</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: db.connected ? '#22C55E' : '#EF4444',
                        boxShadow: `0 0 6px ${db.connected ? '#22C55E' : '#EF4444'}`,
                      }}
                    />
                    <span className="text-sm font-medium" style={{ color: db.connected ? '#22C55E' : '#EF4444' }}>
                      {db.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  {db.type && (
                    <p className="mt-2 text-xs text-text-muted">Engine: <span className="text-text-primary">{db.type}</span></p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Daily preview screenshot */}
      <ScreenshotPreview serviceId={service.id} />
    </div>
  );
}

function ScreenshotPreview({ serviceId }: { serviceId: number }) {
  const [hasPreview, setHasPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const previewSrc = servicePreviewUrl(serviceId);

  const checkPreview = useCallback(() => {
    fetch(previewSrc, { method: 'HEAD' })
      .then((res) => setHasPreview(res.ok))
      .catch(() => setHasPreview(false));
  }, [previewSrc]);

  useEffect(() => {
    checkPreview();
  }, [checkPreview]);

  const handleCapture = async () => {
    setCapturing(true);
    try {
      await captureServiceScreenshot(serviceId);
      setImgKey((k) => k + 1);
      setHasPreview(true);
    } catch {
      // silently fail — the user sees no new image
    } finally {
      setCapturing(false);
    }
  };

  return (
    <>
      <div
        className="rounded-xl border p-6 lg:col-span-2"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary">📸 Daily Preview</h3>
          <button
            onClick={handleCapture}
            disabled={capturing}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-50"
            style={{ backgroundColor: '#C8A951', color: '#0A0F1A' }}
          >
            {capturing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Capturing…
              </span>
            ) : (
              '📷 Capture Now'
            )}
          </button>
        </div>
        {hasPreview ? (
          <>
            <p className="mb-3 text-xs text-text-muted">Latest screenshot captured while the service was UP.</p>
            <button
              onClick={() => setExpanded(true)}
              className="block overflow-hidden rounded-lg border transition-all hover:border-accent/40"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${previewSrc}?v=${imgKey}`}
                alt="Daily service preview"
                className="w-full max-h-80 object-cover object-top"
                loading="lazy"
              />
            </button>
          </>
        ) : (
          <p className="text-sm text-text-muted">No preview available yet. Click &quot;Capture Now&quot; to take one.</p>
        )}
      </div>

      {/* Lightbox */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpanded(false)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm text-white transition-colors hover:bg-white/20"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${previewSrc}?v=${imgKey}`}
              alt="Daily preview fullscreen"
              className="max-h-[85vh] max-w-[85vw] rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}

function HealthChecksTab({
  checks,
  total,
  page,
  loading: isLoading,
  onPageChange,
}: {
  checks: HealthCheckRecord[];
  total: number;
  page: number;
  loading: boolean;
  onPageChange: (p: number) => void;
}) {
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg" style={{ backgroundColor: '#111827' }} />
        ))}
      </div>
    );
  }

  if (checks.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border py-24"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <p className="text-base font-semibold text-text-primary">No health checks yet</p>
        <p className="mt-2 text-sm text-text-muted">Checks will appear here once the monitor starts running.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="overflow-hidden rounded-xl border"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th className="px-4 py-3 text-left font-mono text-xs text-text-muted uppercase tracking-wider">Time</th>
              <th className="px-4 py-3 text-left font-mono text-xs text-text-muted uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right font-mono text-xs text-text-muted uppercase tracking-wider">Response</th>
              <th className="px-4 py-3 text-right font-mono text-xs text-text-muted uppercase tracking-wider">HTTP</th>
              <th className="px-4 py-3 text-left font-mono text-xs text-text-muted uppercase tracking-wider">Error</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr
                key={check.id}
                className="transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <td className="px-4 py-3 font-mono text-xs text-text-muted whitespace-nowrap">
                  {new Date(check.checkedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={check.status} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-text-primary">
                  {check.responseTimeMs != null ? `${check.responseTimeMs}ms` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-text-primary">
                  {check.statusCode ?? '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-status-down max-w-64 truncate">
                  {check.errorMessage ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-text-muted">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-lg border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-lg border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function IncidentsTab({
  incidents,
  total,
  page,
  loading: isLoading,
  onPageChange,
}: {
  incidents: IncidentRecord[];
  total: number;
  page: number;
  loading: boolean;
  onPageChange: (p: number) => void;
}) {
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg" style={{ backgroundColor: '#111827' }} />
        ))}
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border py-24"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <div className="mb-3 text-3xl">✅</div>
        <p className="text-base font-semibold text-text-primary">No incidents</p>
        <p className="mt-2 text-sm text-text-muted">This service has no recorded incidents.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {incidents.map((incident) => {
          const isOpen = incident.resolvedAt == null;
          return (
            <div
              key={incident.id}
              className="rounded-xl border p-5 transition-colors"
              style={{
                backgroundColor: '#111827',
                borderColor: isOpen ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold"
                      style={
                        isOpen
                          ? { color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.15)' }
                          : { color: '#22C55E', backgroundColor: 'rgba(34,197,94,0.15)' }
                      }
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: isOpen ? '#EF4444' : '#22C55E' }}
                      />
                      {isOpen ? 'ONGOING' : 'RESOLVED'}
                    </span>
                    <span className="font-mono text-xs text-text-muted">#{incident.id}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-text-muted">
                    <span>Started: <strong className="text-text-primary">{new Date(incident.startedAt).toLocaleString()}</strong></span>
                    {incident.resolvedAt && (
                      <span>Resolved: <strong className="text-text-primary">{new Date(incident.resolvedAt).toLocaleString()}</strong></span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs text-text-muted">Duration</p>
                  <p className="font-mono text-sm font-semibold text-text-primary">
                    {formatDuration(incident.startedAt, incident.resolvedAt)}
                  </p>
                </div>
              </div>
              {incident.emailSent && (
                <div className="mt-3 flex items-center gap-2 text-xs text-text-muted" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                  <span>📧</span>
                  <span>Alert email sent {incident.emailSentAt ? `at ${new Date(incident.emailSentAt).toLocaleString()}` : ''}</span>
                </div>
              )}

              {/* Screenshot thumbnail */}
              {incident.screenshotPath && (
                <div className="mt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                  <p className="mb-2 font-mono text-xs text-text-muted uppercase tracking-wider">📸 Screenshot at incident time</p>
                  <button
                    onClick={() => setExpandedScreenshot(screenshotUrl(incident.screenshotPath!))}
                    className="block overflow-hidden rounded-lg border transition-all hover:border-accent/40"
                    style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshotUrl(incident.screenshotPath)}
                      alt={`Screenshot at incident #${incident.id}`}
                      className="h-36 w-64 object-cover object-top"
                      loading="lazy"
                    />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Screenshot lightbox */}
      {expandedScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setExpandedScreenshot(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpandedScreenshot(null)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm text-white transition-colors hover:bg-white/20"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expandedScreenshot}
              alt="Screenshot fullscreen"
              className="max-h-[85vh] max-w-[85vw] rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-text-muted">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-lg border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-lg border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-30"
              style={{ borderColor: 'rgba(255,255,255,0.12)' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const serviceId = Number(id);

  const [service, setService] = useState<ServiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Health checks state
  const [checks, setChecks] = useState<HealthCheckRecord[]>([]);
  const [checksTotal, setChecksTotal] = useState(0);
  const [checksPage, setChecksPage] = useState(1);
  const [checksLoading, setChecksLoading] = useState(false);

  // Incidents state
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [incidentsTotal, setIncidentsTotal] = useState(0);
  const [incidentsPage, setIncidentsPage] = useState(1);
  const [incidentsLoading, setIncidentsLoading] = useState(false);

  // Latest check for overview
  const [latestCheck, setLatestCheck] = useState<HealthCheckRecord | null>(null);
  const [checking, setChecking] = useState(false);
  const [resourceWarning, setResourceWarning] = useState<WsResourceWarning | null>(null);

  // Load service
  useEffect(() => {
    servicesApi
      .get(serviceId)
      .then(setService)
      .catch(() => setService(null))
      .finally(() => setLoading(false));
  }, [serviceId]);

  // Load latest check for overview status
  useEffect(() => {
    healthApi.getChecks(serviceId, 1, 1).then((res: PaginatedHealthChecks) => {
      setLatestCheck(res.data.length > 0 ? res.data[0]! : null);
    }).catch(() => { /* ignore */ });
  }, [serviceId]);

  // Load health checks when tab is active or page changes
  useEffect(() => {
    if (activeTab !== 'health-checks') return;
    setChecksLoading(true);
    healthApi
      .getChecks(serviceId, checksPage)
      .then((res: PaginatedHealthChecks) => {
        setChecks(res.data);
        setChecksTotal(res.total);
      })
      .catch(() => setChecks([]))
      .finally(() => setChecksLoading(false));
  }, [serviceId, activeTab, checksPage]);

  // Load incidents when tab is active or page changes
  useEffect(() => {
    if (activeTab !== 'incidents') return;
    setIncidentsLoading(true);
    healthApi
      .getIncidents(serviceId, incidentsPage)
      .then((res: PaginatedIncidents) => {
        setIncidents(res.data);
        setIncidentsTotal(res.total);
      })
      .catch(() => setIncidents([]))
      .finally(() => setIncidentsLoading(false));
  }, [serviceId, activeTab, incidentsPage]);

  // WebSocket: real-time updates
  const onHealthUpdate = useCallback(
    (data: WsHealthUpdate) => {
      if (data.serviceId !== serviceId) return;
      const newCheck: HealthCheckRecord = {
        id: Date.now(), // temp id for rendering
        serviceId: data.serviceId,
        status: data.status as HealthCheckRecord['status'],
        responseTimeMs: data.responseTimeMs,
        statusCode: data.statusCode,
        errorMessage: null,
        checkedAt: data.checkedAt,
      };
      setLatestCheck(newCheck);
      // Prepend to checks list if on first page
      setChecksPage((p) => {
        if (p === 1) {
          setChecks((prev) => [newCheck, ...prev.slice(0, 19)]);
          setChecksTotal((t) => t + 1);
        }
        return p;
      });
    },
    [serviceId],
  );

  useMonitorSocket({
    onHealthUpdate,
    onIncidentNew: useCallback(
      (data: WsIncidentNew) => {
        if (data.serviceId !== serviceId) return;
        // Refresh incidents if on first page
        setIncidentsPage((p) => {
          if (p === 1) {
            healthApi.getIncidents(serviceId, 1).then((res: PaginatedIncidents) => {
              setIncidents(res.data);
              setIncidentsTotal(res.total);
            }).catch(() => { /* ignore */ });
          }
          return p;
        });
      },
      [serviceId],
    ),
    onIncidentResolved: useCallback(
      (data: WsIncidentResolved) => {
        if (data.serviceId !== serviceId) return;
        // Update resolved incident in list
        setIncidents((prev) =>
          prev.map((inc) =>
            inc.id === data.id ? { ...inc, resolvedAt: data.resolvedAt } : inc,
          ),
        );
      },
      [serviceId],
    ),
    onResourceWarning: useCallback(
      (data: WsResourceWarning) => {
        if (data.serviceId !== serviceId) return;
        setResourceWarning(data);
      },
      [serviceId],
    ),
  });

  // Manual check
  const handleCheckNow = useCallback(async () => {
    setChecking(true);
    try {
      const result = await healthApi.check(serviceId);
      setLatestCheck(result);
      // Refresh checks if currently viewing first page
      if (checksPage === 1) {
        healthApi.getChecks(serviceId, 1).then((res: PaginatedHealthChecks) => {
          setChecks(res.data);
          setChecksTotal(res.total);
        }).catch(() => { /* ignore */ });
      }
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }, [serviceId, checksPage]);

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

      {/* Resource warning banner */}
      {resourceWarning && (
        <div
          className="mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
          style={{
            backgroundColor: 'rgba(245,158,11,0.08)',
            borderColor: 'rgba(245,158,11,0.25)',
          }}
        >
          <span className="mt-0.5 text-base">⚠️</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold" style={{ color: '#F59E0B' }}>Resource Warning</p>
            {resourceWarning.warnings.map((w, i) => (
              <p key={i} className="text-xs text-text-muted mt-0.5">
                {w.type === 'disk' ? '💾 Disk' : '🧠 Memory'}: <strong className="text-text-primary">{w.usedPercent.toFixed(1)}%</strong> used (threshold: {w.threshold}%) — {w.detail}
              </p>
            ))}
          </div>
          <button
            onClick={() => setResourceWarning(null)}
            className="shrink-0 text-text-muted hover:text-text-primary transition-colors text-xs"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {activeTab === 'overview' && (
        <OverviewTab
          service={service}
          latestCheck={latestCheck}
          onCheckNow={handleCheckNow}
          checking={checking}
        />
      )}
      {activeTab === 'health-checks' && (
        <HealthChecksTab
          checks={checks}
          total={checksTotal}
          page={checksPage}
          loading={checksLoading}
          onPageChange={setChecksPage}
        />
      )}
      {activeTab === 'incidents' && (
        <IncidentsTab
          incidents={incidents}
          total={incidentsTotal}
          page={incidentsPage}
          loading={incidentsLoading}
          onPageChange={setIncidentsPage}
        />
      )}
      {activeTab === 'logs' && <LogViewer serviceId={serviceId} />}
    </DashboardShell>
  );
}
