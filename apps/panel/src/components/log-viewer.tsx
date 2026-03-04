'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { logsApi } from '@/lib/logs-api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogViewerProps {
  serviceId: number;
}

type LineLevel = 'error' | 'warn' | 'info' | 'debug' | 'plain';

const LINES_OPTIONS = [50, 100, 200, 500] as const;
const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '5s', value: 5_000 },
  { label: '10s', value: 10_000 },
  { label: '30s', value: 30_000 },
] as const;

// ─── Syntax highlighting ──────────────────────────────────────────────────────

function classifyLine(line: string): LineLevel {
  const upper = line.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('CRIT')) return 'error';
  if (upper.includes('WARN') || upper.includes('WARNING')) return 'warn';
  if (upper.includes('INFO')) return 'info';
  if (upper.includes('DEBUG') || upper.includes('TRACE')) return 'debug';
  return 'plain';
}

const LEVEL_COLORS: Record<LineLevel, string> = {
  error: '#EF4444',
  warn: '#F59E0B',
  info: '#60A5FA',
  debug: '#6B7280',
  plain: '#D1D5DB',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LogViewer({ serviceId }: LogViewerProps) {
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<number>(100);
  const [filter, setFilter] = useState('');
  const [autoRefreshMs, setAutoRefreshMs] = useState(0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);

  // ── Fetch logs ────────────────────────────────────────────────────────────

  const fetchLogs = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const res = await logsApi.fetch(serviceId, lines);
        setLogs(res.logs);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load logs';
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [serviceId, lines],
  );

  // Initial load
  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoScrollEnabled && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScrollEnabled]);

  // ── Auto-refresh ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (autoRefreshMs > 0) {
      refreshTimerRef.current = setInterval(() => {
        // Only refresh when tab is visible
        if (isVisibleRef.current) {
          void fetchLogs(true);
        }
      }, autoRefreshMs);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefreshMs, fetchLogs]);

  // ── Visibility API ────────────────────────────────────────────────────────

  useEffect(() => {
    function handleVisibility() {
      isVisibleRef.current = !document.hidden;
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── Process log lines ─────────────────────────────────────────────────────

  const allLines = logs.split('\n');
  const filterLower = filter.toLowerCase();
  const filteredLines = filter
    ? allLines.filter((line: string) => line.toLowerCase().includes(filterLower))
    : allLines;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}
      >
        {/* Search / Filter */}
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter logs…"
            className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-xs font-mono text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          />
        </div>

        {/* Lines selector */}
        <select
          value={lines}
          onChange={(e) => setLines(Number(e.target.value))}
          className="rounded-lg border px-2 py-1.5 text-xs text-text-primary outline-none cursor-pointer"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          {LINES_OPTIONS.map((n) => (
            <option key={n} value={n} style={{ backgroundColor: '#111827' }}>
              {n} lines
            </option>
          ))}
        </select>

        {/* Auto-refresh selector */}
        <select
          value={autoRefreshMs}
          onChange={(e) => setAutoRefreshMs(Number(e.target.value))}
          className="rounded-lg border px-2 py-1.5 text-xs text-text-primary outline-none cursor-pointer"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          {REFRESH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ backgroundColor: '#111827' }}>
              {opt.value === 0 ? 'Auto-refresh: Off' : `Refresh: ${opt.label}`}
            </option>
          ))}
        </select>

        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
          className="rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
          style={{
            backgroundColor: autoScrollEnabled ? 'rgba(200,169,81,0.15)' : 'rgba(255,255,255,0.04)',
            borderColor: autoScrollEnabled ? 'rgba(200,169,81,0.3)' : 'rgba(255,255,255,0.1)',
            color: autoScrollEnabled ? '#C8A951' : '#9CA3AF',
          }}
          title={autoScrollEnabled ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
        >
          ↓ Auto
        </button>

        {/* Refresh button */}
        <button
          onClick={() => void fetchLogs(true)}
          disabled={loading}
          className="rounded-lg border px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-white/5 disabled:opacity-50"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          {refreshing ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
              Refreshing…
            </span>
          ) : (
            '↻ Refresh'
          )}
        </button>

        {/* Status indicators */}
        {autoRefreshMs > 0 && (
          <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-status-up animate-pulse" />
            Live
          </span>
        )}

        {filter && (
          <span className="text-[10px] text-text-muted">
            {filteredLines.length} / {allLines.length} lines
          </span>
        )}
      </div>

      {/* Log content */}
      {loading && !refreshing ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : error ? (
        <div className="px-4 py-8 text-center text-sm text-status-down">{error}</div>
      ) : (
        <div
          ref={containerRef}
          className="overflow-auto font-mono text-xs leading-5"
          style={{ maxHeight: '600px', backgroundColor: '#0A0F1A' }}
        >
          <table className="w-full border-collapse">
            <tbody>
              {filteredLines.map((line: string, idx: number) => {
                const level = classifyLine(line);
                const lineNum = filter
                  ? allLines.indexOf(line) + 1
                  : idx + 1;

                return (
                  <tr
                    key={idx}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Line number */}
                    <td
                      className="select-none border-r px-3 py-0 text-right align-top"
                      style={{
                        color: '#4B5563',
                        borderColor: 'rgba(255,255,255,0.06)',
                        minWidth: '3rem',
                        userSelect: 'none',
                      }}
                    >
                      {lineNum}
                    </td>
                    {/* Log content */}
                    <td
                      className="px-3 py-0 whitespace-pre-wrap break-all"
                      style={{ color: LEVEL_COLORS[level] }}
                    >
                      {filter ? highlightMatch(line, filter) : line || '\u00A0'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Highlight matches in filtered text ─────────────────────────────────────

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  let lastIndex = 0;
  let searchFrom = 0;

  while (searchFrom < lower.length) {
    const matchIdx = lower.indexOf(queryLower, searchFrom);
    if (matchIdx === -1) break;

    if (matchIdx > lastIndex) {
      parts.push(text.slice(lastIndex, matchIdx));
    }
    parts.push(
      <mark
        key={matchIdx}
        style={{
          backgroundColor: 'rgba(200,169,81,0.3)',
          color: '#C8A951',
          borderRadius: '2px',
          padding: '0 1px',
        }}
      >
        {text.slice(matchIdx, matchIdx + query.length)}
      </mark>,
    );

    lastIndex = matchIdx + query.length;
    searchFrom = lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      className="absolute left-2.5 top-1/2 -translate-y-1/2"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6B7280"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
