import React from 'react';
import type { Block } from '../types';
import { ListMarker } from './ListMarker';
import { InlineMarkdown } from './InlineMarkdown';

interface ListItemBodyProps {
  block: Block;
  index?: number | null;
  imageBaseDir?: string;
  onImageClick?: (src: string, alt: string) => void;
}

export const ListItemBody: React.FC<ListItemBodyProps> = ({ block, index, imageBaseDir, onImageClick }) => (
  <div className="flex gap-2 items-start" data-block-id={block.id}>
    <ListMarker ordered={block.ordered ?? false} index={index} checked={block.checked} />
    <span className="flex-1 min-w-0 text-[15px] leading-relaxed text-foreground/90">
      <InlineMarkdown text={block.content} imageBaseDir={imageBaseDir} onImageClick={onImageClick} />
    </span>
  </div>
);
