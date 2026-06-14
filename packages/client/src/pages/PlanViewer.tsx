import { useState, useEffect, useRef, useMemo } from 'react';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { api, type PlanResponse, type Comment } from '../api';
import { MermaidBlock } from '../components/MermaidBlock';
import { Comments, CommentRow } from '../components/Comments';
import { SelectionCommentButton } from '../components/SelectionCommentButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { Footer } from '../components/Footer';

function getCreatorToken(series_id: string): string | null {
  return localStorage.getItem(`pact_token_${series_id}`);
}

function parseAnchor(anchor: string): { start: number; end: number; quote: string | null } {
  const [anchorPart, ...quoteParts] = anchor.split('#');
  const quote = quoteParts.length ? quoteParts.join('#') : null;
  if (anchorPart.includes('..')) {
    const [s, e] = anchorPart.split('..');
    return { start: parseInt(s.slice(2)), end: parseInt(e.slice(2)), quote };
  }
  const line = parseInt(anchorPart.slice(2));
  return { start: line, end: line, quote };
}

function markQuote(children: React.ReactNode, quote: string): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const idx = child.toLowerCase().indexOf(quote.toLowerCase());
      if (idx === -1) return child;
      return (
        <>
          {child.slice(0, idx)}
          <mark style={{ backgroundColor: 'var(--highlight-bg)', borderRadius: '2px', padding: '0 1px' }}>
            {child.slice(idx, idx + quote.length)}
          </mark>
          {child.slice(idx + quote.length)}
        </>
      );
    }
    if (React.isValidElement(child)) {
      const el = child as React.ReactElement<{ children?: React.ReactNode }>;
      if (el.props.children) {
        return React.cloneElement(el, {}, markQuote(el.props.children, quote));
      }
    }
    return child;
  });
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
  const [rejecting, setRejecting] = useState(false);
  const [delisting, setDelisting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [highlightAnchor, setHighlightAnchor] = useState<string | null>(null);
  const proseRef = useRef<HTMLDivElement>(null);

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
        return api.getComments(p.series_id);
      })
      .then(setComments)
      .catch((e: { status?: number }) => {
        setError(e.status === 404 ? 'This plan has expired or been removed.' : 'Failed to load plan.');
      });
  }, [share_token]);

  const anchoredComments = useMemo(() => {
    const map: Record<string, Comment[]> = {};
    for (const c of comments) {
      if (!c.anchor) continue;
      const anchorPart = c.anchor.split('#')[0];
      // Range anchor p-5..p-13 → attach thread to end block so it appears after the selection
      const startBlock = anchorPart.includes('..') ? anchorPart.split('..')[1] : anchorPart;
      (map[startBlock] ??= []).push(c);
    }
    return map;
  }, [comments]);

  // markdownComponents must be defined before early returns (rules of hooks)
  const creator_token_memo = plan ? getCreatorToken(plan.series_id) : null;
  const markdownComponents = useMemo(() => {
    type MdNode = { position?: { start: { line: number } } };

    function makeBlock(Tag: React.ElementType) {
      return function Block({ node, children, ...props }: React.HTMLAttributes<HTMLElement> & { node?: MdNode }) {
        // Use source line number as anchor — stable across re-renders, immune to StrictMode double-invocation
        const anchor = node?.position ? `p-${node.position.start.line}` : null;
        const blockLine = node?.position?.start.line ?? null;
        const thread = anchor ? (anchoredComments[anchor] ?? []) : [];
        const parsed = highlightAnchor ? parseAnchor(highlightAnchor) : null;
        const inRange = parsed !== null && blockLine !== null && blockLine >= parsed.start && blockLine <= parsed.end;
        const quote = inRange && parsed!.start === parsed!.end ? parsed!.quote : null;
        return (
          <>
            <Tag
              data-pact-anchor={anchor ?? undefined}
              style={inRange ? { backgroundColor: 'var(--highlight-bg)', borderRadius: '3px' } : undefined}
              {...props}
            >
              {quote ? markQuote(children, quote) : children}
            </Tag>
            {thread.length > 0 && (
              <div className="space-y-1.5 my-2 pl-3" style={{ borderLeft: '2px solid var(--action-primary)' }}>
                {thread.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    series_id={plan?.series_id ?? ''}
                    creator_token={creator_token_memo}
                    onDelete={deleteComment}
                    onUpdate={updateComment}
                    onResolve={resolveComment}
                    onHighlight={setHighlightAnchor}
                  />
                ))}
              </div>
            )}
          </>
        );
      };
    }

    return {
      p: makeBlock('p'),
      h1: makeBlock('h1'),
      h2: makeBlock('h2'),
      h3: makeBlock('h3'),
      h4: makeBlock('h4'),
      h5: makeBlock('h5'),
      h6: makeBlock('h6'),
      li: makeBlock('li'),
      pre: makeBlock('pre'),
      blockquote: makeBlock('blockquote'),
      code({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
        const lang = /language-(\w+)/.exec(className ?? '')?.[1];
        if (lang === 'mermaid') {
          return <MermaidBlock code={String(children).trim()} />;
        }
        return <code className={className} {...props}>{children}</code>;
      },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.content, anchoredComments, creator_token_memo, highlightAnchor]);

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
    if (!plan) return;
    setApproving(true);
    try {
      await api.approvePlan(plan.series_id, creator_token ?? '');
      setPlan({ ...plan, approved: true, rejected: false });
    } finally {
      setApproving(false);
    }
  }

  async function reject() {
    if (!plan) return;
    setRejecting(true);
    try {
      await api.rejectPlan(plan.series_id, creator_token ?? '');
      setPlan({ ...plan, rejected: true, approved: false });
    } finally {
      setRejecting(false);
    }
  }

  function resolveComment(comment_id: string) {
    if (!plan) return;
    api.resolveComment(plan.series_id, comment_id, creator_token ?? '').catch(() => null);
    setComments((prev) => prev.map((c) => c.id === comment_id ? { ...c, resolved: true } : c));
  }

  async function delist() {
    if (!plan) return;
    setDelisting(true);
    try {
      await api.delistPlan(plan.series_id, creator_token ?? '');
      navigate('/');
    } finally {
      setDelisting(false);
      setConfirmDelete(false);
    }
  }

  async function addComment(body: string, anchor?: string) {
    if (!plan) return;
    const c = await api.addComment(plan.series_id, body, anchor);
    if (c.commenter_token) {
      localStorage.setItem(`pact_comment_token_${c.id}`, c.commenter_token);
    }
    setComments((prev) => [...prev, c]);
  }

  function updateComment(comment_id: string, body: string) {
    setComments((prev) => prev.map((c) => c.id === comment_id ? { ...c, body } : c));
  }

  function deleteComment(comment_id: string) {
    if (!plan) return;
    const commenterToken = localStorage.getItem(`pact_comment_token_${comment_id}`);
    const token = commenterToken || creator_token;
    if (!token) return;
    api.deleteComment(plan.series_id, comment_id, token).catch(() => null);
    setComments((prev) => prev.filter((c) => c.id !== comment_id));
    setHighlightAnchor(null);
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
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-fg)' }}>
              Approved ✓
            </span>
          )}
          {plan.rejected && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-fg)' }}>
              Rejected ✗
            </span>
          )}
          {!plan.approved && !plan.rejected && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn-fg)' }}>
              Pending
            </span>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {title && (
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
        )}
        <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
          {new Date(plan.created_at).toLocaleString()} · {plan.source_tool}
        </p>


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
            <div className="relative">
              <div ref={proseRef} className="prose prose-gray dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={markdownComponents}
                >
                  {plan.content}
                </ReactMarkdown>
              </div>
              <SelectionCommentButton
                containerRef={proseRef}
                onSubmit={(body, anchor) => addComment(body, anchor ?? undefined)}
              />
            </div>
          )}
        </div>

        <Comments
          series_id={plan.series_id}
          creator_token={creator_token}
          comments={comments}
          onAdd={addComment}
          onDelete={deleteComment}
          onUpdate={updateComment}
          onResolve={resolveComment}
          onHighlightAnchor={setHighlightAnchor}
        />
        <Footer />
      </main>

      {/* Floating action bar */}
      {!editing && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border z-20"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {!plan.approved && !plan.rejected && (
            <>
              <button
                onClick={approve}
                disabled={approving}
                className="px-4 py-1.5 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--success-fg)' }}
              >
                {approving ? 'Approving…' : '✓ Approve'}
              </button>
              <button
                onClick={reject}
                disabled={rejecting}
                className="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-fg)' }}
              >
                {rejecting ? 'Rejecting…' : '✗ Reject'}
              </button>
              <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border)' }} />
            </>
          )}
          {(plan.approved || plan.rejected) && (
            <>
              <button
                onClick={plan.approved ? reject : approve}
                disabled={approving || rejecting}
                className="px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
              >
                {plan.approved ? '✗ Reject' : '✓ Approve'}
              </button>
              <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border)' }} />
            </>
          )}
          <button
            onClick={startEdit}
            className="px-3 py-1.5 text-sm rounded-lg border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
          >
            Edit
          </button>
          {confirmDelete ? (
            <>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Delete?</span>
              <button
                onClick={delist}
                disabled={delisting}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-fg)' }}
              >
                {delisting ? '…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1.5 text-xs rounded-lg transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 text-sm rounded-lg transition-colors"
              style={{ color: 'var(--error-fg)', backgroundColor: 'transparent' }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
