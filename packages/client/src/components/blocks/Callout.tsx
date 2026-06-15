import React from 'react';
import type { Block } from '../../types';
import { renderProseBody } from './proseBody';

interface CalloutProps {
  block: Block;
  imageBaseDir?: string;
  onImageClick?: (src: string, alt: string) => void;
}

export const Callout: React.FC<CalloutProps> = ({ block, imageBaseDir, onImageClick }) => (
  <div
    className="my-4 pl-4 pr-3 py-2 rounded-md bg-muted/40 border border-border/60"
    data-block-id={block.id}
    data-block-type="directive"
    data-directive-kind={block.directiveKind}
  >
    {block.directiveKind && (
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {block.directiveKind}
      </div>
    )}
    {renderProseBody({ body: block.content, imageBaseDir, onImageClick })}
  </div>
);
