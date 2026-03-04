export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Logo / Title */}
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-status-up animate-pulse" />
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-accent">Health</span>
            <span className="text-text-primary">Panel</span>
          </h1>
          <div className="h-3 w-3 rounded-full bg-status-up animate-pulse" />
        </div>

        {/* Subtitle */}
        <p className="text-text-muted font-mono text-sm tracking-widest uppercase">
          Enterprise Monitoring Dashboard
        </p>

        {/* Loading indicator */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex gap-2">
            <div className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
            <div className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:-0.15s]" />
            <div className="h-2 w-2 rounded-full bg-accent animate-bounce" />
          </div>
          <p className="text-text-muted font-mono text-xs">Dashboard loading...</p>
        </div>

        {/* Status bar */}
        <div className="mt-8 rounded-lg border border-surface bg-surface px-6 py-4">
          <div className="flex items-center gap-8 font-mono text-xs text-text-muted">
            <span>
              Status:{' '}
              <span className="text-status-up font-semibold">OPERATIONAL</span>
            </span>
            <span>
              Version:{' '}
              <span className="text-accent-tech">v0.1.0</span>
            </span>
            <span>
              Mode:{' '}
              <span className="text-accent">FASE 1</span>
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}
