import React from 'react';

interface Props {
  text: string;
  imageBaseDir?: string;
  onImageClick?: (src: string, alt: string) => void;
}

type Span =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; children: Span[] }
  | { kind: 'italic'; children: Span[] }
  | { kind: 'bolditalic'; children: Span[] }
  | { kind: 'strike'; children: Span[] }
  | { kind: 'code'; value: string }
  | { kind: 'link'; href: string; label: string }
  | { kind: 'image'; src: string; alt: string };

function parseSpans(text: string): Span[] {
  const spans: Span[] = [];
  let i = 0;

  while (i < text.length) {
    // Image: ![alt](src)
    if (text[i] === '!' && text[i + 1] === '[') {
      const closeAlt = text.indexOf('](', i + 2);
      if (closeAlt !== -1) {
        const closeSrc = text.indexOf(')', closeAlt + 2);
        if (closeSrc !== -1) {
          spans.push({ kind: 'image', alt: text.slice(i + 2, closeAlt), src: text.slice(closeAlt + 2, closeSrc) });
          i = closeSrc + 1;
          continue;
        }
      }
    }

    // Link: [label](href)
    if (text[i] === '[') {
      const closeLabel = text.indexOf('](', i + 1);
      if (closeLabel !== -1) {
        const closeHref = text.indexOf(')', closeLabel + 2);
        if (closeHref !== -1) {
          spans.push({ kind: 'link', label: text.slice(i + 1, closeLabel), href: text.slice(closeLabel + 2, closeHref) });
          i = closeHref + 1;
          continue;
        }
      }
    }

    // Bold+italic: ***text***
    if (text.startsWith('***', i)) {
      const end = text.indexOf('***', i + 3);
      if (end !== -1) {
        spans.push({ kind: 'bolditalic', children: parseSpans(text.slice(i + 3, end)) });
        i = end + 3;
        continue;
      }
    }

    // Bold: **text** or __text__
    if (text.startsWith('**', i) || text.startsWith('__', i)) {
      const marker = text.slice(i, i + 2);
      const end = text.indexOf(marker, i + 2);
      if (end !== -1) {
        spans.push({ kind: 'bold', children: parseSpans(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    // Italic: *text* or _text_ (not ** or __)
    if ((text[i] === '*' && text[i + 1] !== '*') || (text[i] === '_' && text[i + 1] !== '_')) {
      const marker = text[i];
      const end = text.indexOf(marker, i + 1);
      if (end !== -1 && text[end + 1] !== marker) {
        spans.push({ kind: 'italic', children: parseSpans(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    // Strikethrough: ~~text~~
    if (text.startsWith('~~', i)) {
      const end = text.indexOf('~~', i + 2);
      if (end !== -1) {
        spans.push({ kind: 'strike', children: parseSpans(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    // Inline code: `code`
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        spans.push({ kind: 'code', value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // Bare URL
    if (text.startsWith('https://', i) || text.startsWith('http://', i)) {
      const end = text.slice(i).search(/[\s)\]>,"']/);
      const url = end === -1 ? text.slice(i) : text.slice(i, i + end);
      spans.push({ kind: 'link', href: url, label: url });
      i += url.length;
      continue;
    }

    // Plain text accumulation
    const last = spans[spans.length - 1];
    if (last?.kind === 'text') {
      last.value += text[i];
    } else {
      spans.push({ kind: 'text', value: text[i] });
    }
    i++;
  }

  return spans;
}

function renderSpans(spans: Span[], imageBaseDir: string | undefined, onImageClick: ((src: string, alt: string) => void) | undefined, keyPrefix = ''): React.ReactNode[] {
  return spans.map((span, idx) => {
    const key = `${keyPrefix}${idx}`;
    switch (span.kind) {
      case 'text':
        return span.value;
      case 'bold':
        return <strong key={key}>{renderSpans(span.children, imageBaseDir, onImageClick, key)}</strong>;
      case 'italic':
        return <em key={key}>{renderSpans(span.children, imageBaseDir, onImageClick, key)}</em>;
      case 'bolditalic':
        return <strong key={key}><em>{renderSpans(span.children, imageBaseDir, onImageClick, key)}</em></strong>;
      case 'strike':
        return <del key={key}>{renderSpans(span.children, imageBaseDir, onImageClick, key)}</del>;
      case 'code':
        return <code key={key} className="px-1 py-0.5 rounded text-[0.85em] font-mono bg-muted/60 text-foreground/90">{span.value}</code>;
      case 'link':
        return (
          <a
            key={key}
            href={span.href}
            target={/^https?:\/\//.test(span.href) ? '_blank' : undefined}
            rel={/^https?:\/\//.test(span.href) ? 'noopener noreferrer' : undefined}
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {span.label}
          </a>
        );
      case 'image': {
        const src = span.src.startsWith('http') || span.src.startsWith('data:')
          ? span.src
          : imageBaseDir
            ? `${imageBaseDir.replace(/\/$/, '')}/${span.src}`
            : span.src;
        return (
          <img
            key={key}
            src={src}
            alt={span.alt}
            className="max-w-full rounded cursor-pointer"
            onClick={onImageClick ? () => onImageClick(src, span.alt) : undefined}
          />
        );
      }
    }
  });
}

export const InlineMarkdown: React.FC<Props> = ({ text, imageBaseDir, onImageClick }) => {
  const spans = parseSpans(text);
  return <>{renderSpans(spans, imageBaseDir, onImageClick)}</>;
};
