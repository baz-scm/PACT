import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type PlanResponse } from '../api';
import { ThemeToggle } from '../components/ThemeToggle';
import { Footer } from '../components/Footer';

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
                <button
                  onClick={() => setHideRejected((v) => !v)}
                  className="text-xs px-2 py-1 rounded border transition-colors"
                  style={{
                    borderColor: 'var(--border)',
                    color: hideRejected ? 'var(--text-secondary)' : 'var(--text-primary)',
                    backgroundColor: hideRejected ? 'transparent' : 'var(--bg-section)',
                  }}
                >
                  {hideRejected ? 'Show rejected' : 'Hide rejected'}
                </button>
                <button
                  onClick={() => setHideImplemented((v) => !v)}
                  className="text-xs px-2 py-1 rounded border transition-colors"
                  style={{
                    borderColor: 'var(--border)',
                    color: hideImplemented ? 'var(--text-secondary)' : 'var(--text-primary)',
                    backgroundColor: hideImplemented ? 'transparent' : 'var(--bg-section)',
                  }}
                >
                  {hideImplemented ? 'Show implemented' : 'Hide implemented'}
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {plans.filter((p) => (!hideImplemented || !p.implemented) && (!hideRejected || !p.rejected)).map((plan) => {
                const title = plan.content.split('\n')[0].replace(/^#+\s*/, '').trim() || plan.series_id;
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
                        <Badge bg="var(--bg-section)" fg="var(--text-tertiary)">Implemented</Badge>
                      ) : plan.approved ? (
                        <Badge bg="var(--success-bg)" fg="var(--success-fg)">Approved</Badge>
                      ) : plan.rejected ? (
                        <Badge bg="var(--error-bg)" fg="var(--error-fg)">Rejected</Badge>
                      ) : (
                        <Badge bg="var(--warn-bg)" fg="var(--warn-fg)">Pending</Badge>
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

function Badge({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  );
}
