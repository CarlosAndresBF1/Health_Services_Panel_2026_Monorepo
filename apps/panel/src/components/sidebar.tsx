'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { logout } from '@/lib/auth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutIcon /> },
  { href: '/services', label: 'Services', icon: <ServerIcon /> },
  { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navContent = (
    <>
      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:bg-white/5 hover:text-text-primary',
              ].join(' ')}
            >
              <span className={isActive ? 'text-accent' : 'text-text-muted'}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="border-t p-3"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-muted transition-all duration-150 hover:bg-white/5 hover:text-text-primary"
        >
          <LogOutIcon />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────── */}
      <header
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b px-4 md:hidden"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="HealthPanel" className="h-7 w-7" />
          <span className="text-base font-bold tracking-tight">
            <span style={{ color: '#C8A951' }}>Health</span>
            <span className="text-text-primary">Panel</span>
          </span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
        </button>
      </header>

      {/* ── Mobile overlay backdrop ────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ──────────────────────────────────── */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-300 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {/* Brand */}
        <div
          className="flex h-14 items-center gap-3 border-b px-4"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="HealthPanel" className="h-7 w-7" />
            <span className="text-base font-bold tracking-tight">
              <span style={{ color: '#C8A951' }}>Health</span>
              <span className="text-text-primary">Panel</span>
            </span>
          </div>
        </div>
        {navContent}
      </aside>

      {/* ── Desktop sidebar (always visible ≥ md) ─────────── */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r md:flex"
        style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {/* Brand */}
        <div
          className="flex h-16 items-center gap-3 border-b px-5"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="HealthPanel" className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">
              <span style={{ color: '#C8A951' }}>Health</span>
              <span className="text-text-primary">Panel</span>
            </span>
          </div>
        </div>
        {navContent}
      </aside>
    </>
  );
}
