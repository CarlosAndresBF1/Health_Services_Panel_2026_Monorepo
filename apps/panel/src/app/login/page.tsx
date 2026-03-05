'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
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
            <h2 className="text-lg font-semibold text-text-primary">Sign in</h2>
            <p className="mt-1 text-sm text-text-muted">
              Enter your credentials to access the dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {/* Username field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="font-mono text-xs font-medium uppercase tracking-wider text-text-muted"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="rounded-lg border px-4 py-2.5 font-mono text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted/50 focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: '#0A0F1A',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
                placeholder="admin"
              />
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="font-mono text-xs font-medium uppercase tracking-wider text-text-muted"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              disabled={isLoading || !username || !password}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                backgroundColor: '#C8A951',
                color: '#0A0F1A',
              }}
            >
              {isLoading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Authenticating...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center font-mono text-xs text-text-muted">
          SECURED ACCESS &mdash; UNAUTHORIZED USE PROHIBITED
        </p>
      </div>
    </main>
  );
}
