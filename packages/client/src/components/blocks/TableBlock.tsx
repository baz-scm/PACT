import React from 'react';
import type { Block } from '../../types';
import { InlineMarkdown } from '../InlineMarkdown';

interface TableBlockProps {
  block: Block;
  imageBaseDir?: string;
  onImageClick?: (src: string, alt: string) => void;
}

export const parseTableContent = (content: string): { headers: string[]; rows: string[][] } => {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] =>
    line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replace(/\\\|/g, '|'));

  const headers = parseRow(lines[0]);
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^[|\-:\s]+$/.test(line)) continue;
    rows.push(parseRow(line));
  }
  return { headers, rows };
};

export const TableBlock: React.FC<TableBlockProps> = ({ block, imageBaseDir, onImageClick }) => {
  const { headers, rows } = parseTableContent(block.content);

  return (
    <div className="my-4 overflow-x-auto" data-block-id={block.id}>
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map((header, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-foreground/90 bg-muted/30">
                <InlineMarkdown text={header} imageBaseDir={imageBaseDir} onImageClick={onImageClick} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-b border-border/50 hover:bg-muted/20">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-3 py-2 text-foreground/80">
                  <InlineMarkdown text={cell} imageBaseDir={imageBaseDir} onImageClick={onImageClick} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
