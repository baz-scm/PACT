import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { api, type PlanResponse } from '../api';
import { ExpiryBanner } from '../components/ExpiryBanner';
import { MermaidBlock } from '../components/MermaidBlock';
import { Comments } from '../components/Comments';
import { ThemeToggle } from '../components/ThemeToggle';
import { Footer } from '../components/Footer';

function getCreatorToken(series_id: string): string | null {
  return localStorage.getItem(`pact_token_${series_id}`);
}

function extractTitle(content: string): string {
  const firstLine = content.split('\n').find((l) => l.trim());
  return firstLine?.replace(/^#+\s*/, '').trim() ?? '';
}

export function PlanViewer() {
  const { share_token } = useParams<{ share_token: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [delisting, setDelisting] = useState(false);

  useEffect(() => {
    if (!share_token) return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const tokenFromUrl = hash.get('token');
    api.getByShareToken(share_token)
      .then((p) => {
        if (tokenFromUrl) {
          localStorage.setItem(`pact_token_${p.series_id}`, tokenFromUrl);
          window.history.replaceState(null, '', window.location.pathname);
        }
        setPlan(p);
      })
      .catch((e: { status?: number }) => {
        setError(e.status === 404 ? 'This plan has expired or been removed.' : 'Failed to load plan.');
      });
  }, [share_token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-tertiary)' }}>{error}</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
      </div>
    );
  }

  const creator_token = getCreatorToken(plan.series_id);
  const isCreator = !!creator_token;

  function startEdit() {
    setDraft(plan!.content);
    setEditing(true);
  }

  async function save() {
    if (!creator_token || !plan) return;
    setSaving(true);
    const prev = plan;
    setPlan({ ...plan, content: draft });
    try {
      const updated = await api.savePlan(plan.series_id, draft, creator_token);
      setPlan(updated);
      setEditing(false);
    } catch {
      setPlan(prev);
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!creator_token || !plan) return;
    setApproving(true);
    try {
      await api.approvePlan(plan.series_id, creator_token);
      setPlan({ ...plan, approved: true });
    } finally {
      setApproving(false);
    }
  }

  async function delist() {
    if (!creator_token || !plan) return;
    if (!confirm('Delete this plan? This cannot be undone.')) return;
    setDelisting(true);
    try {
      await api.delistPlan(plan.series_id, creator_token);
      navigate('/');
    } finally {
      setDelisting(false);
    }
  }

  const title = extractTitle(plan.content);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b"
        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          ← Back
        </button>

        <div className="flex items-center gap-2">
          {plan.approved && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-fg)' }}
            >
              Approved ✓
            </span>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Plan title */}
        {title && (
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
        )}
        <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
          {new Date(plan.created_at).toLocaleString()} · {plan.source_tool}
        </p>

        {/* Action bar */}
        {isCreator && !editing && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {!plan.approved && (
              <button
                onClick={approve}
                disabled={approving}
                className="px-4 py-1.5 text-sm font-medium rounded-md text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--action-primary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--action-primary-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--action-primary)')}
              >
                {approving ? 'Approving…' : '✓ Approve'}
              </button>
            )}
            <button
              onClick={startEdit}
              className="px-3 py-1.5 text-sm rounded-md border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-section)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Edit
            </button>
            <button
              onClick={delist}
              disabled={delisting}
              className="px-3 py-1.5 text-sm rounded-md border transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--error-fg)', color: 'var(--error-fg)', backgroundColor: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--error-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Delete
            </button>
          </div>
        )}

        <ExpiryBanner expiresAt={plan.expires_at} />

        <div className="mt-4">
          {editing ? (
            <div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full rounded-md p-3 text-sm resize-none h-96 focus:outline-none"
                style={{
                  border: `1px solid var(--border)`,
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm font-medium rounded-md text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--action-primary)' }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-1.5 text-sm rounded-md border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code({ className, children, ...props }) {
                    const lang = /language-(\w+)/.exec(className ?? '')?.[1];
                    if (lang === 'mermaid') {
                      return <MermaidBlock code={String(children).trim()} />;
                    }
                    return <code className={className} {...props}>{children}</code>;
                  },
                }}
              >
                {plan.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <Comments series_id={plan.series_id} creator_token={creator_token} />
        <Footer />
      </main>
    </div>
  );
}
