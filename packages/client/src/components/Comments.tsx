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
    <div className="mt-10 border-t pt-6">
      <h2 className="text-lg font-semibold mb-4">Comments</h2>
      <div className="space-y-3 mb-6">
        {comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2 text-sm">
            <div className="flex-1 bg-gray-50 rounded p-3">
              <p className="whitespace-pre-wrap">{c.body}</p>
              <span className="text-gray-400 text-xs mt-1 block">{relativeTime(c.created_at)}</span>
            </div>
            {creator_token && (
              <button
                onClick={() => remove(c.id)}
                className="text-gray-300 hover:text-red-400 mt-1"
                title="Delete comment"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {comments.length === 0 && <p className="text-gray-400 text-sm">No comments yet.</p>}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment…"
        className="w-full border rounded p-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      <button
        onClick={submit}
        disabled={!body.trim()}
        className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-40"
      >
        Post
      </button>
    </div>
  );
}
