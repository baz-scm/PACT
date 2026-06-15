export type AlertKind = 'note' | 'tip' | 'warning' | 'caution' | 'important';

export interface Block {
  id: string;
  type: 'paragraph' | 'heading' | 'blockquote' | 'list-item' | 'code' | 'hr' | 'table' | 'html' | 'directive';
  content: string;
  level?: number;
  language?: string;
  checked?: boolean;
  ordered?: boolean;
  orderedStart?: number;
  alertKind?: AlertKind;
  directiveKind?: string;
  order: number;
  startLine: number;
}
