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

      {/* Main content area, offset by sidebar width */}
      <main className="ml-60 flex flex-1 flex-col">
        {/* Page header */}
        {(title || actions) && (
          <header
            className="sticky top-0 z-30 flex h-16 items-center justify-between border-b px-8"
            style={{
              backgroundColor: 'rgba(10,15,26,0.85)',
              backdropFilter: 'blur(8px)',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <div>
              {title && (
                <h1 className="text-base font-semibold text-text-primary">{title}</h1>
              )}
              {subtitle && (
                <p className="text-xs text-text-muted">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </header>
        )}

        {/* Page content */}
        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
