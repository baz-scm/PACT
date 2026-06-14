import { useState, useEffect, useRef } from 'react';

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSubmit: (body: string, anchor: string | null) => Promise<void>;
}

interface Pos {
  x: number;
  y: number;
  anchor: string | null;
}

function getPos(container: HTMLElement): Pos | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount || sel.isCollapsed || !sel.toString().trim()) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const rect = range.getBoundingClientRect();

  // Anchor: read the data-pact-anchor attribute set by PlanViewer's markdownComponents
  const node = range.commonAncestorContainer;
  const el = (node.nodeType === 3 ? node.parentElement : node) as HTMLElement | null;
  const block = el?.closest('[data-pact-anchor]') as HTMLElement | null;
  const blockAnchor = block?.dataset.pactAnchor ?? null;
  const quote = sel.toString().replace(/\s+/g, ' ').trim().slice(0, 150);
  const anchor = blockAnchor ? (quote ? `${blockAnchor}#${quote}` : blockAnchor) : null;

  return { x: rect.right, y: rect.top - 4, anchor };
}

export function SelectionCommentButton({ containerRef, onSubmit }: Props) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Frozen pos when form opens (text selection may clear after that)
  const frozenPos = useRef<Pos | null>(null);

  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      // Ignore if clicking inside the floating UI
      const floating = document.getElementById('scb-floating');
      if (floating?.contains(e.target as Node)) return;
      const container = containerRef.current;
      if (!container) return;
      // Small delay so browser finishes updating selection
      requestAnimationFrame(() => {
        const p = getPos(container);
        if (p) setPos(p);
        else if (!formOpen) setPos(null);
      });
    }
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [containerRef, formOpen]);

  function openForm(e: React.MouseEvent) {
    e.preventDefault(); // prevent focus steal → preserves text selection
    frozenPos.current = pos;
    setFormOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 30);
  }

  function dismiss() {
    setFormOpen(false);
    setPos(null);
    setBody('');
    frozenPos.current = null;
    window.getSelection()?.removeAllRanges();
  }

  async function submit() {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(body.trim(), frozenPos.current?.anchor ?? null);
      dismiss();
    } finally {
      setSubmitting(false);
    }
  }

  const displayPos = formOpen ? frozenPos.current : pos;
  if (!displayPos) return null;

  return (
    <>
      {/* Backdrop: catches outside clicks when form is open */}
      {formOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 49 }}
          onMouseDown={dismiss}
        />
      )}
      <div
        id="scb-floating"
        style={{ position: 'fixed', left: displayPos.x + 8, top: displayPos.y, zIndex: 50 }}
      >
        {!formOpen ? (
          <button
            onMouseDown={openForm}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full shadow-md whitespace-nowrap"
            style={{ backgroundColor: 'var(--action-primary)', color: '#fff' }}
          >
            💬 Comment
          </button>
        ) : (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="flex flex-col gap-1.5 p-2 rounded-lg shadow-lg"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', width: '240px' }}
          >
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') dismiss();
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit();
              }}
              placeholder="Add a comment… (⌘↵ to post)"
              rows={3}
              className="w-full text-xs resize-none rounded p-1.5 focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-section)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontFamily: 'Inter, sans-serif',
              }}
            />
            <div className="flex gap-1.5 justify-end">
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={dismiss}
                className="px-2 py-1 text-xs rounded"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Cancel
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={submit}
                disabled={!body.trim() || submitting}
                className="px-2 py-1 text-xs font-medium rounded text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--action-primary)' }}
              >
                {submitting ? '…' : 'Post'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
