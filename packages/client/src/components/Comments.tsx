import { useState } from 'react';
import { api, type Comment } from '../api';

interface Props {
  series_id: string;
  comments: Comment[];
  onAdd: (body: string, anchor?: string) => Promise<void>;
  onDelete: (comment_id: string) => void;
  onUpdate: (comment_id: string, body: string) => void;
  onResolve?: (comment_id: string) => void;
  onHighlightAnchor?: (anchor: string | null) => void;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function Comments({ series_id, comments, onAdd, onDelete, onUpdate, onResolve, onHighlightAnchor }: Props) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const threadComments = comments.filter((c) => !c.anchor);

  async function submit() {
    if (!body.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await onAdd(body.trim());
      setBody('');
    } catch (e) {
      const err = e as { status?: number };
      setError(err.status === 429 ? 'Rate limit hit — try again in a minute.' : 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Comments
      </h2>
      <div className="space-y-3 mb-6">
        {threadComments.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            series_id={series_id}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onResolve={onResolve}
            onHighlight={onHighlightAnchor}
          />
        ))}
        {threadComments.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No comments yet.</p>
        )}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit(); }}
        data-comment-input
        placeholder="Add a comment…"
        className="w-full rounded-md p-2.5 text-sm resize-none h-20 focus:outline-none"
        style={{
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
        }}
      />
      {error && <p className="text-sm mt-1" style={{ color: 'var(--error-fg)' }}>{error}</p>}
      <button
        onClick={submit}
        disabled={!body.trim() || submitting}
        className="mt-2 px-4 py-1.5 text-sm font-medium rounded-md text-white disabled:opacity-40"
        style={{ backgroundColor: 'var(--action-primary)' }}
      >
        Post
      </button>
    </div>
  );
}

export function CommentRow({
  comment,
  series_id,
  onDelete,
  onUpdate,
  onResolve,
  onHighlight,
}: {
  comment: Comment;
  series_id: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, body: string) => void;
  onResolve?: (id: string) => void;
  onHighlight?: (anchor: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);

  const quote = comment.anchor?.includes('#') ? comment.anchor.split('#').slice(1).join('#') : null;

  async function save() {
    if (!editBody.trim()) return;
    setSaving(true);
    try {
      await api.updateComment(series_id, comment.id, editBody.trim());
      onUpdate(comment.id, editBody.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex items-start gap-2 text-sm"
      style={{ opacity: comment.resolved ? 0.45 : 1 }}
      onMouseEnter={() => onHighlight?.(comment.anchor)}
      onMouseLeave={() => onHighlight?.(null)}
    >
      <div
        className="flex-1 rounded-md p-3"
        style={{ backgroundColor: 'var(--bg-section)', border: '1px solid var(--border)' }}
      >
        {editing ? (
          <>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setEditing(false); setEditBody(comment.body); }
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save();
              }}
              autoFocus
              rows={3}
              className="w-full text-sm resize-none rounded p-1 focus:outline-none"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={save}
                disabled={!editBody.trim() || saving}
                className="text-xs px-2 py-0.5 rounded font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--action-primary)' }}
              >
                {saving ? '…' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setEditBody(comment.body); }}
                className="text-xs px-2 py-0.5 rounded"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {quote && (
              <p
                className="text-xs mb-1.5 pl-2 italic truncate"
                style={{ color: 'var(--text-tertiary)', borderLeft: '2px solid var(--border)' }}
              >
                {quote}
              </p>
            )}
            <p
              className="whitespace-pre-wrap"
              style={{ color: 'var(--text-primary)', textDecoration: comment.resolved ? 'line-through' : 'none' }}
            >
              {comment.body}
            </p>
            <span className="text-xs mt-1 block" style={{ color: 'var(--text-tertiary)' }}>
              {relativeTime(comment.created_at)}{comment.resolved ? ' · resolved' : ''}
            </span>
          </>
        )}
      </div>
      <div className="flex flex-col gap-1 mt-1">
        {!comment.resolved && onResolve && (
          <button
            onClick={() => onResolve(comment.id)}
            className="text-xs transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--success-fg)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            title="Resolve comment"
          >
            ✓
          </button>
        )}
        {!editing && !comment.resolved && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--action-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            title="Edit comment"
          >
            ✎
          </button>
        )}
        <button
          onClick={() => onDelete(comment.id)}
          className="text-xs transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error-fg)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          title="Delete comment"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
