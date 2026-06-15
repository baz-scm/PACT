import React from 'react';
import type { Block } from '../types';
import { InlineMarkdown } from './InlineMarkdown';
import { CodeBlock } from './blocks/CodeBlock';
import { TableBlock } from './blocks/TableBlock';
import { AlertBlock } from './blocks/AlertBlock';
import { Callout } from './blocks/Callout';
import { ListItemBody } from './ListItemBody';
import type { AlertKind } from '../types';

interface BlockRendererProps {
  block: Block;
  index?: number | null;
  highlighted?: boolean;
  imageBaseDir?: string;
  onImageClick?: (src: string, alt: string) => void;
  onClick?: (blockId: string) => void;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  index,
  highlighted,
  imageBaseDir,
  onImageClick,
  onClick,
}) => {
  const wrapClass = highlighted ? 'ring-2 ring-primary/40 rounded' : '';
  const handleClick = onClick ? () => onClick(block.id) : undefined;

  switch (block.type) {
    case 'heading': {
      const Tag = `h${block.level ?? 1}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const sizeClass: Record<number, string> = {
        1: 'text-3xl font-bold mt-8 mb-4',
        2: 'text-2xl font-semibold mt-6 mb-3',
        3: 'text-xl font-semibold mt-5 mb-2',
        4: 'text-lg font-medium mt-4 mb-2',
        5: 'text-base font-medium mt-3 mb-1',
        6: 'text-sm font-medium mt-3 mb-1 text-muted-foreground',
      };
      return (
        <Tag
          id={block.id}
          className={`${sizeClass[block.level ?? 1] ?? sizeClass[1]} scroll-mt-20 ${wrapClass}`}
          data-block-id={block.id}
          onClick={handleClick}
        >
          <InlineMarkdown text={block.content} imageBaseDir={imageBaseDir} onImageClick={onImageClick} />
        </Tag>
      );
    }

    case 'hr':
      return <hr className="my-8 border-border/50" data-block-id={block.id} />;

    case 'code':
      return (
        <div className={wrapClass} onClick={handleClick}>
          <CodeBlock block={block} />
        </div>
      );

    case 'table':
      return (
        <div className={wrapClass} onClick={handleClick}>
          <TableBlock block={block} imageBaseDir={imageBaseDir} onImageClick={onImageClick} />
        </div>
      );

    case 'blockquote': {
      if (block.alertKind) {
        return (
          <div className={wrapClass} onClick={handleClick}>
            <AlertBlock
              blockId={block.id}
              kind={block.alertKind as AlertKind}
              body={block.content}
              imageBaseDir={imageBaseDir}
              onImageClick={onImageClick}
            />
          </div>
        );
      }
      return (
        <blockquote
          className={`my-4 pl-4 border-l-4 border-border text-muted-foreground italic ${wrapClass}`}
          data-block-id={block.id}
          onClick={handleClick}
        >
          <InlineMarkdown text={block.content} imageBaseDir={imageBaseDir} onImageClick={onImageClick} />
        </blockquote>
      );
    }

    case 'list-item':
      return (
        <div className={`my-0.5 ${wrapClass}`} onClick={handleClick}>
          <ListItemBody block={block} index={index} imageBaseDir={imageBaseDir} onImageClick={onImageClick} />
        </div>
      );

    case 'directive':
      return (
        <div className={wrapClass} onClick={handleClick}>
          <Callout block={block} imageBaseDir={imageBaseDir} onImageClick={onImageClick} />
        </div>
      );

    case 'html':
      return (
        <div
          className={`my-4 text-sm text-muted-foreground font-mono bg-muted/30 rounded p-2 ${wrapClass}`}
          data-block-id={block.id}
          onClick={handleClick}
        >
          {block.content}
        </div>
      );

    case 'paragraph':
    default:
      return (
        <p
          className={`my-4 text-[15px] leading-relaxed text-foreground/90 ${wrapClass}`}
          data-block-id={block.id}
          onClick={handleClick}
        >
          <InlineMarkdown text={block.content} imageBaseDir={imageBaseDir} onImageClick={onImageClick} />
        </p>
      );
  }
};
