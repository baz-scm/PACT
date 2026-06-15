import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type PlanResponse } from '../api';
import { ThemeToggle } from '../components/ThemeToggle';
import { Footer } from '../components/Footer';
import { Badge } from '../components/designSystem/Badge';
import { FilterChip } from '../components/designSystem/FilterChip';

export function Landing() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideImplemented, setHideImplemented] = useState(true);
  const [implementing, setImplementing] = useState<string | null>(null);

  async function markImplemented(e: React.MouseEvent, series_id: string) {
    e.stopPropagation();
    setImplementing(series_id);
    try {
      await api.implementPlan(series_id);
      setPlans((prev) => prev.map((p) => p.series_id === series_id ? { ...p, status: 'implemented' } : p));
    } finally {
      setImplementing(null);
    }
  }

  const fetchPlans = useCallback(async () => {
    try {
      const results = await api.listAll();
      setPlans(results);
    } catch {
      // server not reachable — keep stale list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPlans();
    const id = setInterval(() => { void fetchPlans(); }, 3000);
    return () => clearInterval(id);
  }, [fetchPlans]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b"
        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <span className="font-semibold text-sm tracking-wide" style={{ color: 'var(--text-primary)' }}>
          PACT
        </span>
        <ThemeToggle />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
              style={{ backgroundColor: 'var(--bg-section)', border: '1px solid var(--border)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="13" x2="15" y2="13" />
                <line x1="9" y1="17" x2="13" y2="17" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              No plans yet
            </h1>
            <p className="text-sm max-w-xs mb-6" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
              Install the PACT hook to start capturing plans from Claude Code or Cursor.
            </p>
            <div
              className="rounded-lg px-4 py-3 text-left w-full max-w-sm"
              style={{ backgroundColor: 'var(--bg-section)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Install hook</p>
              <code className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                npx @baz-scm/pact-hooks install
              </code>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Plans</h1>
              <div className="flex gap-2">
                <FilterChip active={!hideImplemented} onClick={() => setHideImplemented((v) => !v)}>
                  Implemented
                </FilterChip>
              </div>
            </div>
            {(() => {
              const filtered = plans.filter((p) => !hideImplemented || p.status !== 'implemented');
              if (filtered.length === 0) {
                return (
                  <p className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                    All plans hidden by filters.
                  </p>
                );
              }
              return (
                <ul className="space-y-2">
                  {filtered.map((plan) => {
                const GENERIC = new Set(['context', 'overview', 'summary', 'plan', 'background', 'goal', 'goals', 'approach']);
                const title = (() => {
                  for (const line of plan.content.split('\n')) {
                    const t = line.trim();
                    if (!t) continue;
                    const text = t.replace(/^#+\s*/, '').trim();
                    if (/^#+\s/.test(t) && GENERIC.has(text.toLowerCase())) continue;
                    if (text) return text;
                  }
                  return plan.series_id;
                })();
                return (
                    <li
                      key={plan.series_id}
                      onClick={() => navigate(`/viewer/${plan.share_token}`)}
                      className="group flex items-center justify-between gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'var(--border)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-section)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card)')}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {title}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {new Date(plan.created_at).toLocaleString()} · {plan.source_tool}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {plan.status !== 'implemented' && (
                          <button
                            onClick={(e) => void markImplemented(e, plan.series_id)}
                            disabled={implementing === plan.series_id}
                            className="text-xs px-2 py-1 rounded border opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border)' }}
                          >
                            {implementing === plan.series_id ? '…' : '✓ Done'}
                          </button>
                        )}
                        <Badge variant={plan.status} />
                      </div>
                    </li>
                  );
                  })}
                </ul>
              );
            })()}
          </>
        )}
        <Footer />
      </main>
    </div>
  );
}

