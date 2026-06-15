import React, { useEffect, useRef, useState } from 'react';
import type { Block } from '../types';
import { InlineMarkdown } from './InlineMarkdown';

interface TocItem {
  id: string;
  level: number;
  text: string;
  children: TocItem[];
}

function buildTocItems(blocks: Block[]): TocItem[] {
  const headings = blocks.filter(b => b.type === 'heading' && (b.level ?? 1) <= 3);
  const result: TocItem[] = [];
  const stack: TocItem[] = [];

  for (const h of headings) {
    const item: TocItem = { id: h.id, level: h.level ?? 1, text: h.content, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      result.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }
    stack.push(item);
  }
  return result;
}

function flattenToc(items: TocItem[]): TocItem[] {
  const out: TocItem[] = [];
  for (const item of items) {
    out.push(item);
    out.push(...flattenToc(item.children));
  }
  return out;
}

interface TableOfContentsProps {
  blocks: Block[];
  className?: string;
  style?: React.CSSProperties;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ blocks, className, style }) => {
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  const items = buildTocItems(blocks);
  const flat = flattenToc(items);

  useEffect(() => {
    observerRef.current?.disconnect();
    if (flat.length === 0) return;

    const cb: IntersectionObserverCallback = (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
          break;
        }
      }
    };
    observerRef.current = new IntersectionObserver(cb, { rootMargin: '-10% 0px -80% 0px' });
    for (const item of flat) {
      const el = document.getElementById(item.id);
      if (el) observerRef.current.observe(el);
    }
    return () => observerRef.current?.disconnect();
  }, [blocks]);

  if (flat.length < 2) return null;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderItems = (list: TocItem[]) =>
    list.map(item => (
      <React.Fragment key={item.id}>
        <button
          onClick={() => scrollTo(item.id)}
          className={[
            'w-full text-left py-0.5 px-2 rounded text-[13px] leading-snug transition-colors truncate',
            item.level === 1 ? 'font-medium' : 'pl-4 text-muted-foreground',
            activeId === item.id
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-muted/60 text-foreground/70',
          ].join(' ')}
          title={item.text}
        >
          <InlineMarkdown text={item.text} />
        </button>
        {item.children.length > 0 && renderItems(item.children)}
      </React.Fragment>
    ));

  return (
    <nav className={`flex flex-col gap-0.5 overflow-y-auto ${className ?? ''}`} style={style} aria-label="Table of contents">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pb-1 mb-1 border-b border-border/40">
        On this page
      </div>
      {renderItems(items)}
    </nav>
  );
};
