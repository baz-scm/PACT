import { useState, useEffect, useCallback } from 'react';
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
  const [hideRejected, setHideRejected] = useState(true);

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
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              No plans yet
            </h1>
            <p className="text-sm max-w-sm" style={{ color: 'var(--text-tertiary)' }}>
              Install the PACT hooks to start capturing AI coding plans from Claude Code or Cursor.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Plans</h1>
              <div className="flex gap-2">
                <FilterChip active={!hideRejected} onClick={() => setHideRejected((v) => !v)}>
                  {hideRejected ? 'Show rejected' : 'Hide rejected'}
                </FilterChip>
                <FilterChip active={!hideImplemented} onClick={() => setHideImplemented((v) => !v)}>
                  {hideImplemented ? 'Show implemented' : 'Hide implemented'}
                </FilterChip>
              </div>
            </div>
            <ul className="space-y-2">
              {plans.filter((p) => (!hideImplemented || !p.implemented) && (!hideRejected || !p.rejected)).map((plan) => {
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
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors"
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
                      {plan.implemented ? (
                        <Badge variant="implemented" />
                      ) : plan.approved ? (
                        <Badge variant="approved" />
                      ) : plan.rejected ? (
                        <Badge variant="rejected" />
                      ) : (
                        <Badge variant="pending" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <Footer />
      </main>
    </div>
  );
}

