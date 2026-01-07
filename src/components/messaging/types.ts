// Message Block Types for Rendering

export type InlineFormat =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'link'; content: string; url: string };

export type MessageBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | ListBlock
  | QuoteBlock;

export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: InlineFormat[];
  id?: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  content: InlineFormat[];
  id?: string;
}

export interface ImageBlock {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  id?: string;
}

export interface ButtonBlock {
  type: 'button';
  text: string;
  url?: string;
  onClick?: () => void;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  id?: string;
}

export interface DividerBlock {
  type: 'divider';
  id?: string;
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: (string | InlineFormat[])[];
  id?: string;
}

export interface QuoteBlock {
  type: 'quote';
  content: InlineFormat[];
  author?: string;
  id?: string;
}

export interface MessageBlockRendererProps {
  blocks: MessageBlock[];
  className?: string;
}
