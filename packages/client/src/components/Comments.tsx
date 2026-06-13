import { useState, useEffect } from 'react';
import { api, type Comment } from '../api';

interface Props {
  series_id: string;
  creator_token: string | null;
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

export function Comments({ series_id, creator_token }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getComments(series_id).then(setComments).catch(() => null);
  }, [series_id]);

  async function submit() {
    if (!body.trim()) return;
    setError(null);
    try {
      const c = await api.addComment(series_id, body.trim());
      setComments((prev) => [...prev, c]);
      setBody('');
    } catch (e) {
      const err = e as { status?: number };
      setError(err.status === 429 ? 'Rate limit hit — try again in a minute.' : 'Failed to post comment.');
    }
  }

  async function remove(comment_id: string) {
    if (!creator_token) return;
    await api.deleteComment(series_id, comment_id, creator_token).catch(() => null);
    setComments((prev) => prev.filter((c) => c.id !== comment_id));
  }

  return (
    <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Comments
      </h2>
      <div className="space-y-3 mb-6">
        {comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2 text-sm">
            <div
              className="flex-1 rounded-md p-3"
              style={{ backgroundColor: 'var(--bg-section)', border: '1px solid var(--border)' }}
            >
              <p className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{c.body}</p>
              <span className="text-xs mt-1 block" style={{ color: 'var(--text-tertiary)' }}>
                {relativeTime(c.created_at)}
              </span>
            </div>
            {creator_token && (
              <button
                onClick={() => remove(c.id)}
                className="mt-1 text-sm transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error-fg)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                title="Delete comment"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No comments yet.</p>
        )}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
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
        disabled={!body.trim()}
        className="mt-2 px-4 py-1.5 text-sm font-medium rounded-md text-white disabled:opacity-40"
        style={{ backgroundColor: 'var(--action-primary)' }}
      >
        Post
      </button>
    </div>
  );
}
