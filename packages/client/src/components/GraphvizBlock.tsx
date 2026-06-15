import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Block } from '../types';

interface GraphvizBlockProps {
  block: Block;
}

type RenderState = { status: 'idle' } | { status: 'loading' } | { status: 'ok'; svg: string } | { status: 'error'; message: string };

function normalizeSvgColors(svg: string, isDark: boolean): string {
  if (!isDark) return svg;
  return svg
    .replace(/fill="black"/g, 'fill="currentColor"')
    .replace(/stroke="black"/g, 'stroke="currentColor"')
    .replace(/fill="#000000"/g, 'fill="currentColor"')
    .replace(/stroke="#000000"/g, 'stroke="currentColor"');
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const GraphvizBlock: React.FC<GraphvizBlockProps> = ({ block }) => {
  const [state, setState] = useState<RenderState>({ status: 'idle' });
  const [expanded, setExpanded] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    import('@viz-js/viz').then(({ instance }) => instance()).then((viz) => {
      if (cancelled) return;
      try {
        const svg = viz.renderString(block.content, { format: 'svg', engine: 'dot' });
        const normalized = normalizeSvgColors(svg, isDarkMode());
        setState({ status: 'ok', svg: normalized });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: String(e) });
      }
    }).catch((e) => {
      if (!cancelled) setState({ status: 'error', message: String(e) });
    });
    return () => { cancelled = true; };
  }, [block.content]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.max(0.2, Math.min(5, s - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan(p => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => { dragging.current = false; }, []);

  const resetView = useCallback(() => { setScale(1); setPan({ x: 0, y: 0 }); }, []);

  const DiagramView = ({ svg, className = '' }: { svg: string; className?: string }) => (
    <div
      className={`relative overflow-hidden rounded bg-background ${className}`}
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
    >
      <div
        style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, transformOrigin: 'center', transition: dragging.current ? 'none' : undefined }}
        dangerouslySetInnerHTML={{ __html: svg }}
        className="flex items-center justify-center p-4 [&_svg]:max-w-full [&_svg]:h-auto"
      />
      <div className="absolute bottom-2 right-2 flex gap-1">
        <button onClick={() => setScale(s => Math.min(5, s * 1.2))} className="p-1 rounded bg-muted/80 hover:bg-muted text-xs font-mono">+</button>
        <button onClick={() => setScale(s => Math.max(0.2, s / 1.2))} className="p-1 rounded bg-muted/80 hover:bg-muted text-xs font-mono">−</button>
        <button onClick={resetView} className="p-1 rounded bg-muted/80 hover:bg-muted text-xs font-mono">1:1</button>
      </div>
    </div>
  );

  return (
    <div className="my-5" data-block-id={block.id}>
      {state.status === 'loading' && (
        <div className="h-24 flex items-center justify-center text-muted-foreground text-sm animate-pulse">
          Rendering diagram…
        </div>
      )}
      {state.status === 'error' && (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive font-mono">
          {state.message}
        </div>
      )}
      {state.status === 'ok' && (
        <>
          <div className="relative group">
            <DiagramView svg={state.svg} className="min-h-[160px] border border-border/40" />
            <button
              onClick={() => setExpanded(true)}
              className="absolute top-2 right-2 p-1.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10"
              title="Expand"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
          {expanded && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
              onClick={() => setExpanded(false)}
            >
              <div
                className="relative w-full max-w-5xl h-[80vh] bg-background rounded-lg border border-border shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => setExpanded(false)}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <DiagramView svg={state.svg} className="w-full h-full" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
