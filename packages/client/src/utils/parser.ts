import type { Block } from '../types';

export const HTML_BLOCK_TAGS: ReadonlySet<string> = new Set([
  'details', 'summary',
  'div', 'section', 'article', 'aside', 'header', 'footer',
  'blockquote', 'pre',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'ul', 'ol', 'li', 'p',
]);

const HTML_BLOCK_OPEN_RE = /^<\/?([a-zA-Z][a-zA-Z0-9]*)(?:\s|>|\/|$)/;

export const parseMarkdownToBlocks = (markdown: string): Block[] => {
  const lines = markdown.split('\n');
  const blocks: Block[] = [];
  let currentId = 0;

  let buffer: string[] = [];
  let currentType: Block['type'] = 'paragraph';
  let bufferStartLine = 1;
  let lastLineWasBlank = false;

  const flush = () => {
    if (buffer.length > 0) {
      const content = buffer.join('\n');
      blocks.push({
        id: `block-${currentId++}`,
        type: currentType,
        content,
        order: currentId,
        startLine: bufferStartLine,
      });
      buffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const currentLineNum = i + 1;
    const prevLineWasBlank = lastLineWasBlank;
    lastLineWasBlank = false;

    if (trimmed.startsWith('#')) {
      flush();
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      blocks.push({
        id: `block-${currentId++}`,
        type: 'heading',
        content: trimmed.replace(/^#+\s*/, ''),
        level,
        order: currentId,
        startLine: currentLineNum,
      });
      continue;
    }

    if (trimmed === '---' || trimmed === '***') {
      flush();
      blocks.push({
        id: `block-${currentId++}`,
        type: 'hr',
        content: '',
        order: currentId,
        startLine: currentLineNum,
      });
      continue;
    }

    const listMatch = trimmed.match(/^(\*|-|(\d+)\.)\s/);
    if (listMatch) {
      flush();
      const leadingWhitespace = line.match(/^(\s*)/)?.[1] || '';
      const spaceCount = leadingWhitespace.replace(/\t/g, '  ').length;
      const listLevel = Math.floor(spaceCount / 2);
      const ordered = listMatch[2] !== undefined;
      const orderedStart = ordered ? parseInt(listMatch[2]!, 10) : undefined;
      let content = trimmed.slice(listMatch[0].length);
      let checked: boolean | undefined = undefined;
      const checkboxMatch = content.match(/^\[([ xX])]\s*/);
      if (checkboxMatch) {
        checked = checkboxMatch[1].toLowerCase() === 'x';
        content = content.replace(/^\[([ xX])]\s*/, '');
      }
      blocks.push({
        id: `block-${currentId++}`,
        type: 'list-item',
        content,
        level: listLevel,
        checked,
        ordered: ordered || undefined,
        orderedStart,
        order: currentId,
        startLine: currentLineNum,
      });
      continue;
    }

    if (trimmed.startsWith('>')) {
      flush();
      const stripped = trimmed.replace(/^>\s*/, '');
      const blockMarkerRe = /^(?:(?:\*|-|\d+\.)\s|#|```|>)/;
      const hasBlockMarker = blockMarkerRe.test(stripped);
      const prevBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null;
      const prevIsMarkerQuote = prevBlock?.type === 'blockquote' && blockMarkerRe.test(prevBlock.content);
      const prevIsAlert = prevBlock?.type === 'blockquote' && !!prevBlock.alertKind;
      const shouldMergeIntoAlert = prevIsAlert && !prevLineWasBlank;
      const shouldMergeNormal =
        !hasBlockMarker && !prevIsMarkerQuote && !prevLineWasBlank && prevBlock?.type === 'blockquote';
      if (shouldMergeIntoAlert || shouldMergeNormal) {
        prevBlock!.content = prevBlock!.content ? prevBlock!.content + '\n' + stripped : stripped;
      } else {
        const alertMatch = stripped.match(/^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)]\s*$/i);
        blocks.push({
          id: `block-${currentId++}`,
          type: 'blockquote',
          content: alertMatch ? '' : stripped,
          alertKind: alertMatch
            ? (alertMatch[1].toLowerCase() as 'note' | 'tip' | 'warning' | 'caution' | 'important')
            : undefined,
          order: currentId,
          startLine: currentLineNum,
        });
      }
      continue;
    }

    if (trimmed.startsWith('```')) {
      flush();
      const codeStartLine = currentLineNum;
      const fenceLen = trimmed.match(/^`+/)?.[0].length ?? 3;
      const closingFence = new RegExp('^\\s*`{' + fenceLen + ',}');
      const language = trimmed.slice(fenceLen).trim() || undefined;
      const codeContent: string[] = [];
      i++;
      while (i < lines.length && !closingFence.test(lines[i])) {
        codeContent.push(lines[i]);
        i++;
      }
      blocks.push({
        id: `block-${currentId++}`,
        type: 'code',
        content: codeContent.join('\n'),
        language,
        order: currentId,
        startLine: codeStartLine,
      });
      continue;
    }

    if (trimmed.startsWith('|')) {
      flush();
      const tableStartLine = currentLineNum;
      const tableLines: string[] = [line];
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith('|')) {
          i++;
          tableLines.push(lines[i]);
        } else {
          break;
        }
      }
      blocks.push({
        id: `block-${currentId++}`,
        type: 'table',
        content: tableLines.join('\n'),
        order: currentId,
        startLine: tableStartLine,
      });
      continue;
    }

    const directiveOpen = trimmed.match(/^:::\s*([a-zA-Z][a-zA-Z0-9-]*)\s*$/);
    if (directiveOpen) {
      flush();
      const directiveStartLine = currentLineNum;
      const kind = directiveOpen[1].toLowerCase();
      const bodyLines: string[] = [];
      while (i + 1 < lines.length) {
        i++;
        if (lines[i].trim() === ':::') break;
        bodyLines.push(lines[i]);
      }
      blocks.push({
        id: `block-${currentId++}`,
        type: 'directive',
        content: bodyLines.join('\n'),
        directiveKind: kind,
        order: currentId,
        startLine: directiveStartLine,
      });
      continue;
    }

    const htmlTagMatch = trimmed.match(HTML_BLOCK_OPEN_RE);
    if (htmlTagMatch && HTML_BLOCK_TAGS.has(htmlTagMatch[1].toLowerCase())) {
      flush();
      const htmlStartLine = currentLineNum;
      const tagName = htmlTagMatch[1].toLowerCase();
      const isCloseTag = trimmed.startsWith('</');
      const htmlLines: string[] = [line];
      if (isCloseTag) {
        while (i + 1 < lines.length && lines[i + 1].trim() !== '') {
          i++;
          htmlLines.push(lines[i]);
        }
      } else {
        const openRe = new RegExp(`<${tagName}(?:\\s|>|/|$)`, 'gi');
        const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi');
        let depth = (line.match(openRe) || []).length - (line.match(closeRe) || []).length;
        while (depth > 0 && i + 1 < lines.length) {
          i++;
          htmlLines.push(lines[i]);
          depth += (lines[i].match(openRe) || []).length;
          depth -= (lines[i].match(closeRe) || []).length;
        }
      }
      blocks.push({
        id: `block-${currentId++}`,
        type: 'html',
        content: htmlLines.join('\n'),
        order: currentId,
        startLine: htmlStartLine,
      });
      continue;
    }

    if (trimmed === '') {
      flush();
      currentType = 'paragraph';
      lastLineWasBlank = true;
      continue;
    }

    if (
      buffer.length === 0 &&
      blocks.length > 0 &&
      blocks[blocks.length - 1].type === 'list-item' &&
      (prevLineWasBlank ? /^\s{2,}/ : /^\s+/).test(line)
    ) {
      const sep = prevLineWasBlank ? '\n\n' : '\n';
      blocks[blocks.length - 1].content += sep + trimmed;
      continue;
    }

    if (buffer.length === 0) {
      bufferStartLine = currentLineNum;
    }
    buffer.push(line);
  }

  flush();
  return blocks;
};

export const computeListIndices = (blocks: Block[]): (number | null)[] => {
  const counters: number[] = [];
  const lastOrderedAtLevel: boolean[] = [];

  return blocks.map((block) => {
    const lvl = block.level || 0;
    counters.length = lvl + 1;
    lastOrderedAtLevel.length = lvl + 1;

    if (!block.ordered) {
      lastOrderedAtLevel[lvl] = false;
      return null;
    }

    if (lastOrderedAtLevel[lvl]) {
      counters[lvl] = (counters[lvl] ?? 0) + 1;
    } else {
      counters[lvl] = block.orderedStart ?? 1;
    }
    lastOrderedAtLevel[lvl] = true;
    return counters[lvl];
  });
};
