'use client';

import { logout } from '@/lib/auth';

export default function DashboardPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center p-8"
      style={{ backgroundColor: '#0A0F1A' }}
    >
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-status-up animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight">
              <span style={{ color: '#C8A951' }}>Health</span>
              <span className="text-text-primary">Panel</span>
            </h1>
          </div>
          <button
            onClick={() => logout()}
            className="rounded-lg border px-4 py-2 font-mono text-xs text-text-muted transition-colors hover:border-accent hover:text-accent"
            style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
          >
            Sign out
          </button>
        </div>

        {/* Welcome card */}
        <div
          className="rounded-xl border p-8 text-center"
          style={{
            backgroundColor: '#111827',
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="mb-4 flex justify-center">
            <div className="flex gap-1.5">
              <div className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
              <div className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:-0.15s]" />
              <div className="h-2 w-2 rounded-full bg-accent animate-bounce" />
            </div>
          </div>

          <h2 className="mb-2 text-xl font-semibold text-text-primary">
            Welcome to HealthPanel
          </h2>
          <p className="text-sm text-text-muted">
            Your enterprise monitoring dashboard is ready.
          </p>
          <p className="mt-1 font-mono text-xs text-text-muted">
            Dashboard content will be available in Fase 2.
          </p>
        </div>

        {/* Status bar */}
        <div
          className="mt-6 rounded-lg border px-6 py-4"
          style={{
            backgroundColor: '#111827',
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <div className="flex items-center justify-center gap-8 font-mono text-xs text-text-muted">
            <span>
              Status:{' '}
              <span className="font-semibold text-status-up">OPERATIONAL</span>
            </span>
            <span>
              Version:{' '}
              <span className="text-accent-tech">v0.1.0</span>
            </span>
            <span>
              Mode:{' '}
              <span style={{ color: '#C8A951' }}>FASE 1</span>
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
