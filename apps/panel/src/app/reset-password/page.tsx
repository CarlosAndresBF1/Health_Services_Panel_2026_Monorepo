'use client';

import { FormEvent, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid or missing reset token. Please request a new reset link.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });

      const data = await response.json() as { success: boolean; error?: string };

      if (!response.ok) {
        setError(data.error ?? 'Invalid or expired token. Please request a new reset link.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="rounded-lg border px-4 py-3 font-mono text-xs text-status-down"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.2)',
          }}
        >
          Invalid or expired token. Please request a new reset link.
        </div>
        <Link
          href="/forgot-password"
          className="text-center font-mono text-xs transition-opacity hover:opacity-80"
          style={{ color: '#C8A951' }}
        >
          Request new reset link
        </Link>
        <Link
          href="/login"
          className="text-center font-mono text-xs transition-opacity hover:opacity-80"
          style={{ color: '#C8A951' }}
        >
          &larr; Back to sign in
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="rounded-lg border px-4 py-3 font-mono text-xs"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            borderColor: 'rgba(34, 197, 94, 0.2)',
            color: '#22c55e',
          }}
        >
          Password reset successfully. You can now sign in with your new password.
        </div>
        <Link
          href="/login"
          className="mt-2 flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            backgroundColor: '#C8A951',
            color: '#0A0F1A',
          }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* New password field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="newPassword"
          className="font-mono text-xs font-medium uppercase tracking-wider text-text-muted"
        >
          New Password
        </label>
        <div className="relative">
          <input
            id="newPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            autoFocus
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border px-4 py-2.5 pr-10 font-mono text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: '#0A0F1A',
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
            placeholder="Minimum 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-primary"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Confirm password field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirmPassword"
          className="font-mono text-xs font-medium uppercase tracking-wider text-text-muted"
        >
          Confirm Password
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border px-4 py-2.5 pr-10 font-mono text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: '#0A0F1A',
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-primary"
            tabIndex={-1}
          >
            {showConfirm ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="rounded-lg border px-4 py-3 font-mono text-xs text-status-down"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.2)',
          }}
        >
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading || !newPassword || !confirmPassword}
        className="mt-2 flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          backgroundColor: '#C8A951',
          color: '#0A0F1A',
        }}
      >
        {isLoading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Resetting...
          </>
        ) : (
          'Reset Password'
        )}
      </button>

      <Link
        href="/login"
        className="text-center font-mono text-xs transition-opacity hover:opacity-80"
        style={{ color: '#C8A951' }}
      >
        &larr; Back to sign in
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: '#0A0F1A' }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-status-up animate-pulse" />
            <h1 className="text-3xl font-bold tracking-tight">
              <span style={{ color: '#C8A951' }}>Health</span>
              <span className="text-text-primary">Panel</span>
            </h1>
            <div className="h-2.5 w-2.5 rounded-full bg-status-up animate-pulse" />
          </div>
          <p className="font-mono text-xs tracking-widest text-text-muted uppercase">
            Enterprise Monitoring Dashboard
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl border p-8"
          style={{
            backgroundColor: '#111827',
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-text-primary">Set New Password</h2>
            <p className="mt-1 text-sm text-text-muted">
              Enter your new password below
            </p>
          </div>

          <Suspense
            fallback={
              <div className="flex justify-center py-4">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent text-text-muted" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center font-mono text-xs text-text-muted">
          SECURED ACCESS &mdash; UNAUTHORIZED USE PROHIBITED
        </p>
      </div>
    </main>
  );
}
