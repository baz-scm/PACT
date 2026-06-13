import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { api, type PlanResponse } from '../api';
import { ExpiryBanner } from '../components/ExpiryBanner';
import { MermaidBlock } from '../components/MermaidBlock';
import { Comments } from '../components/Comments';

function getCreatorToken(series_id: string): string | null {
  return localStorage.getItem(`pact_token_${series_id}`);
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-lg">{error}</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {plan.approved && (
            <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Approved ✓
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isCreator && !editing && !plan.approved && (
            <button
              onClick={approve}
              disabled={approving}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {approving ? 'Approving…' : 'Approve'}
            </button>
          )}
          {isCreator && !editing && (
            <button
              onClick={startEdit}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            >
              Edit
            </button>
          )}
          {isCreator && !editing && (
            <button
              onClick={delist}
              disabled={delisting}
              className="px-3 py-1.5 text-sm text-red-500 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <ExpiryBanner expiresAt={plan.expires_at} />

      <div className="mt-4">
        {editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full border rounded p-3 font-mono text-sm resize-none h-96 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-1.5 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="prose prose-gray max-w-none">
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
    </div>
  );
}
