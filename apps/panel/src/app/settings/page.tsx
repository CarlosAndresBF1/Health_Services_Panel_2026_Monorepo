'use client';

import { useCallback, useEffect, useState } from 'react';

import { DashboardShell } from '@/components/dashboard-shell';
import { settingsApi, type SettingsResponse, type UpdateSettingsDto, type ChangePasswordDto } from '@/lib/settings-api';

const INTERVAL_OPTIONS = [
  { label: '1 minute', value: 60_000 },
  { label: '5 minutes', value: 300_000 },
  { label: '10 minutes', value: 600_000 },
  { label: '15 minutes', value: 900_000 },
  { label: '30 minutes', value: 1_800_000 },
  { label: '1 hour', value: 3_600_000 },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Alert form state
  const [emailTo, setEmailTo] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [minInterval, setMinInterval] = useState(300_000);

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
      setEmailTo(data.alert_email_to);
      setEmailFrom(data.alert_email_from);
      setAlertsEnabled(data.alerts_enabled);
      setMinInterval(data.alert_min_interval_ms);
    } catch {
      setToast({ type: 'error', message: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSave() {
    setSaving(true);
    setToast(null);

    try {
      const payload: UpdateSettingsDto = {};
      if (emailTo !== settings?.alert_email_to) payload.alert_email_to = emailTo;
      if (emailFrom !== settings?.alert_email_from) payload.alert_email_from = emailFrom;
      if (alertsEnabled !== settings?.alerts_enabled) payload.alerts_enabled = alertsEnabled;
      if (minInterval !== settings?.alert_min_interval_ms) payload.alert_min_interval_ms = minInterval;

      if (Object.keys(payload).length === 0) {
        setToast({ type: 'success', message: 'No changes to save' });
        setSaving(false);
        return;
      }

      const updated = await settingsApi.update(payload);
      setSettings(updated);
      setToast({ type: 'success', message: 'Settings saved successfully' });
    } catch {
      setToast({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setToast({ type: 'error', message: 'All password fields are required' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ type: 'error', message: 'New password and confirmation do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setToast({ type: 'error', message: 'New password must be at least 8 characters' });
      return;
    }

    setChangingPassword(true);
    setToast(null);
    try {
      const result = await settingsApi.changePassword({ currentPassword, newPassword, confirmPassword } as ChangePasswordDto);
      setToast({ type: 'success', message: result.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to change password' });
    } finally {
      setChangingPassword(false);
    }
  }

  const hasChanges =
    settings !== null &&
    (emailTo !== settings.alert_email_to ||
      emailFrom !== settings.alert_email_from ||
      alertsEnabled !== settings.alerts_enabled ||
      minInterval !== settings.alert_min_interval_ms);

  if (loading) {
    return (
      <DashboardShell title="Settings">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Settings" subtitle="Configure alert notifications">
      {/* Toast */}
      {toast && (
        <div
          className="mb-6 rounded-lg border px-4 py-3 text-sm"
          style={{
            backgroundColor: toast.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            borderColor: toast.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
            color: toast.type === 'success' ? '#22C55E' : '#EF4444',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Alert Configuration */}
      <div
        className="rounded-xl border p-6"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <h2 className="text-base font-semibold text-text-primary mb-1">Alert Configuration</h2>
        <p className="text-sm text-text-muted mb-6">Configure how and when HealthPanel sends alert emails.</p>

        <div className="space-y-5">
          {/* Alerts Enabled Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-text-primary">Global Alerts</label>
              <p className="text-xs text-text-muted mt-0.5">Enable or disable all email alerts system-wide</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={alertsEnabled}
              onClick={() => setAlertsEnabled(!alertsEnabled)}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ backgroundColor: alertsEnabled ? '#C8A951' : 'rgba(255,255,255,0.1)' }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out"
                style={{ transform: alertsEnabled ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

          {/* Email To */}
          <div>
            <label htmlFor="emailTo" className="block text-sm font-medium text-text-primary mb-1.5">
              Alert Recipient
            </label>
            <p className="text-xs text-text-muted mb-2">Email address that receives alert notifications</p>
            <input
              id="emailTo"
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="admin@example.com"
              className="w-full rounded-lg border px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            />
          </div>

          {/* Email From */}
          <div>
            <label htmlFor="emailFrom" className="block text-sm font-medium text-text-primary mb-1.5">
              Sender Address
            </label>
            <p className="text-xs text-text-muted mb-2">Verified SendGrid sender email address</p>
            <input
              id="emailFrom"
              type="email"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="monitor@example.com"
              className="w-full rounded-lg border px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            />
          </div>

          {/* Rate Limit Interval */}
          <div>
            <label htmlFor="minInterval" className="block text-sm font-medium text-text-primary mb-1.5">
              Minimum Alert Interval
            </label>
            <p className="text-xs text-text-muted mb-2">
              Minimum time between alerts for the same service (rate limiting)
            </p>
            <select
              id="minInterval"
              value={minInterval}
              onChange={(e) => setMinInterval(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent appearance-none cursor-pointer"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} style={{ backgroundColor: '#111827' }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={() => void handleSave()}
            disabled={saving || !hasChanges}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: hasChanges ? '#C8A951' : 'rgba(200,169,81,0.3)',
              color: '#0A0F1A',
            }}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving…
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
          {hasChanges && (
            <span className="text-xs text-text-muted">You have unsaved changes</span>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div
        className="mt-6 rounded-xl border p-6"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <h2 className="text-base font-semibold text-text-primary mb-1">Security</h2>
        <p className="text-sm text-text-muted mb-6">Change your administrator password.</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-text-primary mb-1.5">
              Current Password
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-text-primary mb-1.5">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary mb-1.5">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={() => void handleChangePassword()}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#C8A951', color: '#0A0F1A' }}
          >
            {changingPassword ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Updating…
              </span>
            ) : (
              'Update Password'
            )}
          </button>
        </div>
      </div>

      {/* Info card */}
      <div
        className="mt-6 rounded-xl border p-5"
        style={{ backgroundColor: 'rgba(96,165,250,0.05)', borderColor: 'rgba(96,165,250,0.15)' }}
      >
        <h3 className="text-sm font-semibold mb-2" style={{ color: '#60A5FA' }}>
          How Alerts Work
        </h3>
        <ul className="space-y-1.5 text-xs text-text-muted">
          <li>• When a service goes <strong className="text-status-down">DOWN</strong>, HealthPanel collects a screenshot and logs, then sends an email.</li>
          <li>• When the service <strong className="text-status-up">recovers</strong>, a recovery email is sent automatically.</li>
          <li>• Rate limiting prevents duplicate alerts within the configured interval.</li>
          <li>• Individual services can have alerts toggled in their settings page.</li>
          <li>• A <code className="rounded bg-white/5 px-1.5 py-0.5 text-accent">SENDGRID_API_KEY</code> environment variable must be set on the API server.</li>
        </ul>
      </div>
    </DashboardShell>
  );
}
