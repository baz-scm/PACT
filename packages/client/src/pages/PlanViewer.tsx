import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type PlanResponse, type Comment } from '../api';
import { Comments, CommentRow } from '../components/Comments';
import { SelectionCommentButton } from '../components/SelectionCommentButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { Footer } from '../components/Footer';
import { BlockRenderer } from '../components/BlockRenderer';
import { TableOfContents } from '../components/TableOfContents';
import { ResizeHandle } from '../components/ResizeHandle';
import { ShortcutsOverlay } from '../components/ShortcutsOverlay';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { parseMarkdownToBlocks, computeListIndices } from '../utils/parser';

function extractTitle(content: string): string {
  const firstLine = content.split('\n').find((l) => l.trim());
  return firstLine?.replace(/^#+\s*/, '').trim() ?? '';
}

function parseBlockAnchor(anchor: string): { startId: string; endId: string; quote: string | null } {
  const [anchorPart, ...quoteParts] = anchor.split('#');
  const quote = quoteParts.length ? quoteParts.join('#') : null;
  if (anchorPart.includes('..')) {
    const [start, end] = anchorPart.split('..');
    return { startId: start, endId: end, quote };
  }
  return { startId: anchorPart, endId: anchorPart, quote };
}

function blockInRange(blockId: string, startId: string, endId: string): boolean {
  const toNum = (id: string) => parseInt(id.replace('block-', ''), 10);
  const n = toNum(blockId), s = toNum(startId), e = toNum(endId);
  if (isNaN(n) || isNaN(s) || isNaN(e)) return blockId === startId;
  return n >= s && n <= e;
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
  const [implementing, setImplementing] = useState(false);
  const [delisting, setDelisting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [highlightAnchor, setHighlightAnchor] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const proseRef = useRef<HTMLDivElement>(null);

  const { width: tocWidth, isCollapsed: tocCollapsed, onDragStart } = useResizablePanel({
    minWidth: 160,
    maxWidth: 320,
    defaultWidth: 220,
    storageKey: 'pact-toc-width',
    snapThreshold: 60,
  });

  useEffect(() => {
    if (!share_token) return;
    api.getByShareToken(share_token)
      .then((p) => {
        setPlan(p);
        return api.getComments(p.series_id);
      })
      .then(setComments)
      .catch((e: { status?: number }) => {
        setError(e.status === 404 ? 'This plan has expired or been removed.' : 'Failed to load plan.');
      });
  }, [share_token]);

  const blocks = useMemo(() => plan ? parseMarkdownToBlocks(plan.content) : [], [plan?.content]);
  const listIndices = useMemo(() => computeListIndices(blocks), [blocks]);

  const anchoredComments = useMemo(() => {
    const map: Record<string, Comment[]> = {};
    for (const c of comments) {
      if (!c.anchor) continue;
      const anchorPart = c.anchor.split('#')[0];
      const endBlock = anchorPart.includes('..') ? anchorPart.split('..')[1] : anchorPart;
      (map[endBlock] ??= []).push(c);
    }
    return map;
  }, [comments]);

  function startEdit() { setDraft(plan!.content); setEditing(true); }

  async function save() {
    if (!plan) return;
    setSaving(true);
    const prev = plan;
    setPlan({ ...plan, content: draft });
    try {
      const updated = await api.savePlan(plan.series_id, draft);
      setPlan(updated);
      setEditing(false);
    } catch { setPlan(prev); } finally { setSaving(false); }
  }

  async function approve() {
    if (!plan) return;
    setApproving(true);
    try {
      await api.approvePlan(plan.series_id);
      setPlan({ ...plan, approved: true, rejected: false });
    } finally { setApproving(false); }
  }

  async function reject() {
    if (!plan) return;
    setRejecting(true);
    try {
      await api.rejectPlan(plan.series_id);
      setPlan({ ...plan, rejected: true, approved: false });
    } finally { setRejecting(false); }
  }

  async function implement() {
    if (!plan) return;
    setImplementing(true);
    try {
      await api.implementPlan(plan.series_id);
      setPlan({ ...plan, implemented: true });
    } finally { setImplementing(false); }
  }

  function resolveComment(comment_id: string) {
    if (!plan) return;
    api.resolveComment(plan.series_id, comment_id).catch(() => null);
    setComments((prev) => prev.map((c) => c.id === comment_id ? { ...c, resolved: true } : c));
  }

  async function delist() {
    if (!plan) return;
    setDelisting(true);
    try {
      await api.delistPlan(plan.series_id);
      navigate('/');
    } finally { setDelisting(false); setConfirmDelete(false); }
  }

  async function addComment(body: string, anchor?: string) {
    if (!plan) return;
    const c = await api.addComment(plan.series_id, body, anchor);
    setComments((prev) => [...prev, c]);
  }

  function updateComment(comment_id: string, body: string) {
    setComments((prev) => prev.map((c) => c.id === comment_id ? { ...c, body } : c));
  }

  function deleteComment(comment_id: string) {
    if (!plan) return;
    api.deleteComment(plan.series_id, comment_id).catch(() => null);
    setComments((prev) => prev.filter((c) => c.id !== comment_id));
    setHighlightAnchor(null);
  }

  const focusComment = useCallback(() => {
    const el = document.querySelector<HTMLTextAreaElement>('textarea[data-comment-input]');
    el?.focus();
  }, []);

  const anchoredBlockIds = useMemo(() => Object.keys(anchoredComments), [anchoredComments]);

  const navComment = useCallback((dir: 1 | -1) => {
    if (anchoredBlockIds.length === 0) return;
    const current = highlightAnchor ? anchoredBlockIds.indexOf(highlightAnchor.split('#')[0]) : -1;
    const next = (current + dir + anchoredBlockIds.length) % anchoredBlockIds.length;
    const targetId = anchoredBlockIds[next];
    setHighlightAnchor(targetId);
    document.querySelector(`[data-block-id="${targetId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [anchoredBlockIds, highlightAnchor]);

  useKeyboardShortcuts(
    useMemo(() => ({
      a: () => { if (plan && !plan.approved && !plan.rejected) approve(); },
      r: () => { if (plan && !plan.approved && !plan.rejected) reject(); },
      c: focusComment,
      ']': () => navComment(1),
      '[': () => navComment(-1),
      '?': () => setShowShortcuts(v => !v),
    }), [plan, focusComment, navComment]),
    !editing,
  );

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

  const title = extractTitle(plan.content);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}

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

      <main className="max-w-6xl mx-auto px-4 py-8">
        {title && (
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
        )}
        <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
          {new Date(plan.created_at).toLocaleString()} · {plan.source_tool}
          {plan.model_id && ` · ${plan.model_id}`}
          {(plan.input_tokens != null && plan.output_tokens != null) && (() => {
            const total = plan.input_tokens + plan.output_tokens;
            const fmt = total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(total);
            return ` · ${fmt} tokens`;
          })()}
        </p>

        <div className="flex gap-0 items-start">
          {/* TOC sidebar */}
          {!tocCollapsed && (
            <>
              <TableOfContents
                blocks={blocks}
                className="sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto"
                style={{ width: tocWidth, minWidth: tocWidth, flexShrink: 0 } as React.CSSProperties}
              />
              <ResizeHandle onMouseDown={onDragStart} className="mx-2 h-[calc(100vh-6rem)] sticky top-20" />
            </>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
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
                <div ref={proseRef}>
                  {blocks.map((block, i) => {
                    const highlighted = highlightAnchor
                      ? (() => {
                          const { startId, endId } = parseBlockAnchor(highlightAnchor);
                          return blockInRange(block.id, startId, endId);
                        })()
                      : false;
                    const thread = anchoredComments[block.id] ?? [];
                    return (
                      <React.Fragment key={block.id}>
                        <BlockRenderer
                          block={block}
                          index={listIndices[i]}
                          highlighted={highlighted}
                        />
                        {thread.length > 0 && (
                          <div className="space-y-1.5 my-2 pl-3" style={{ borderLeft: '2px solid var(--action-primary)' }}>
                            {thread.map((c) => (
                              <CommentRow
                                key={c.id}
                                comment={c}
                                series_id={plan.series_id}
                                onDelete={deleteComment}
                                onUpdate={updateComment}
                                onResolve={resolveComment}
                                onHighlight={setHighlightAnchor}
                              />
                            ))}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                <SelectionCommentButton
                  containerRef={proseRef}
                  onSubmit={(body, anchor) => addComment(body, anchor ?? undefined)}
                />
              </div>
            )}

            <Comments
              series_id={plan.series_id}
              comments={comments}
              onAdd={addComment}
              onDelete={deleteComment}
              onUpdate={updateComment}
              onResolve={resolveComment}
              onHighlightAnchor={setHighlightAnchor}
            />
            <Footer />
          </div>
        </div>
      </main>

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
          {plan.approved && !plan.implemented && (
            <>
              <button
                onClick={implement}
                disabled={implementing}
                className="px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
              >
                {implementing ? 'Marking…' : '⚑ Mark as Implemented'}
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
          <button
            onClick={() => setShowShortcuts(true)}
            className="px-2 py-1.5 text-xs rounded-lg border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
        </div>
      )}
    </div>
  );
}
