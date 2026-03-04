'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json() as { success: boolean; error?: string };

      if (!response.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

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
            <h2 className="text-lg font-semibold text-text-primary">Password Recovery</h2>
            <p className="mt-1 text-sm text-text-muted">
              Enter your email address and we&apos;ll send you a reset link
            </p>
          </div>

          {success ? (
            <div className="flex flex-col gap-4">
              <div
                className="rounded-lg border px-4 py-3 font-mono text-xs"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.08)',
                  borderColor: 'rgba(34, 197, 94, 0.2)',
                  color: '#22c55e',
                }}
              >
                If an account exists with this email, you&apos;ll receive a reset link shortly.
              </div>
              <Link
                href="/login"
                className="text-center font-mono text-xs transition-opacity hover:opacity-80"
                style={{ color: '#C8A951' }}
              >
                &larr; Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {/* Email field */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="font-mono text-xs font-medium uppercase tracking-wider text-text-muted"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="rounded-lg border px-4 py-2.5 font-mono text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: '#0A0F1A',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                  placeholder="you@example.com"
                />
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
                disabled={isLoading || !email}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  backgroundColor: '#C8A951',
                  color: '#0A0F1A',
                }}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
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
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center font-mono text-xs text-text-muted">
          SECURED ACCESS &mdash; UNAUTHORIZED USE PROHIBITED
        </p>
      </div>
    </main>
  );
}
