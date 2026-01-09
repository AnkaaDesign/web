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
  | SpacerBlock
  | ListBlock
  | QuoteBlock
  | IconBlock
  | RowBlock;

export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: InlineFormat[];
  id?: string;
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

export interface ParagraphBlock {
  type: 'paragraph';
  content: InlineFormat[];
  id?: string;
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

export type ImageSizePreset =
  | '64px' | '128px' | '256px' | '384px'  // Pixel sizes (Icon, Small, Medium, Large)
  | '25%' | '50%' | '75%' | '100%';        // Percentage sizes

export interface ImageBlock {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
  size?: ImageSizePreset; // Preset sizes (pixels or percentages)
  customWidth?: string; // Custom CSS width value
  width?: number;
  height?: number;
  alignment?: 'left' | 'center' | 'right';
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

export interface SpacerBlock {
  type: 'spacer';
  height?: 'sm' | 'md' | 'lg' | 'xl';
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
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

export interface IconBlock {
  type: 'icon';
  icon: string; // Tabler icon name
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  alignment?: 'left' | 'center' | 'right';
  id?: string;
}

export interface RowBlock {
  type: 'row';
  blocks: MessageBlock[]; // Nested blocks to display in a row
  columns?: 2 | 3 | 4;
  gap?: 'none' | 'sm' | 'md' | 'lg';
  verticalAlign?: 'top' | 'center' | 'bottom';
  id?: string;
}

export interface MessageBlockRendererProps {
  blocks: MessageBlock[];
  className?: string;
}
