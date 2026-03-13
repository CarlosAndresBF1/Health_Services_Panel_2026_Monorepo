import { Sidebar } from './sidebar';

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function DashboardShell({ children, title, subtitle, actions }: DashboardShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      {/* Main content area — offset by sidebar width on desktop, top bar on mobile */}
      <main className="flex flex-1 flex-col pt-14 md:ml-60 md:pt-0">
        {/* Page header */}
        {(title || actions) && (
          <header
            className="sticky top-14 z-30 flex h-14 items-center justify-between border-b px-4 md:top-0 md:h-16 md:px-8"
            style={{
              backgroundColor: 'rgba(10,15,26,0.85)',
              backdropFilter: 'blur(8px)',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <div className="min-w-0">
              {title && (
                <h1 className="truncate text-sm font-semibold text-text-primary md:text-base">{title}</h1>
              )}
              {subtitle && (
                <p className="hidden text-xs text-text-muted sm:block">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2 md:gap-3">{actions}</div>}
          </header>
        )}

        {/* Page content */}
        <div className="flex-1 p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
