import { useCallback, useEffect, useRef, useState } from 'react';

interface UseResizablePanelOptions {
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  storageKey?: string;
  snapThreshold?: number;
}

interface UseResizablePanelResult {
  width: number;
  isCollapsed: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  expand: () => void;
  collapse: () => void;
}

function readStorage(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    const n = v !== null ? parseFloat(v) : NaN;
    return isNaN(n) ? fallback : n;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: number) {
  try { localStorage.setItem(key, String(value)); } catch { /* ignore */ }
}

export function useResizablePanel({
  minWidth = 160,
  maxWidth = 400,
  defaultWidth = 220,
  storageKey,
  snapThreshold = 60,
}: UseResizablePanelOptions = {}): UseResizablePanelResult {
  const [width, setWidth] = useState<number>(() =>
    storageKey ? readStorage(storageKey, defaultWidth) : defaultWidth,
  );
  const [isCollapsed, setIsCollapsed] = useState(false);

  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const rafId = useRef<number>(0);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
  }, [width]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const next = Math.max(0, startWidth.current + delta);
        if (next < snapThreshold) {
          setIsCollapsed(true);
          setWidth(minWidth);
        } else {
          setIsCollapsed(false);
          const clamped = Math.max(minWidth, Math.min(maxWidth, next));
          setWidth(clamped);
          if (storageKey) writeStorage(storageKey, clamped);
        }
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      cancelAnimationFrame(rafId.current);
    };
  }, [minWidth, maxWidth, snapThreshold, storageKey]);

  const expand = useCallback(() => {
    setIsCollapsed(false);
    setWidth(storageKey ? readStorage(storageKey, defaultWidth) : defaultWidth);
  }, [storageKey, defaultWidth]);

  const collapse = useCallback(() => setIsCollapsed(true), []);

  return { width, isCollapsed, onDragStart, expand, collapse };
}
