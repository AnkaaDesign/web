export type BlockType =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'paragraph'
  | 'image'
  | 'button'
  | 'divider'
  | 'list'
  | 'quote'
  | 'spacer'
  | 'icon'
  | 'row';

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  link?: string;
}

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface TextBlock extends BaseBlock {
  type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'quote';
  content: string;
  styles?: TextStyle[];
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

export type ImageSizePreset =
  | '64px' | '128px' | '256px' | '384px'  // Pixel sizes (Icon, Small, Medium, Large)
  | '25%' | '50%' | '75%' | '100%';        // Percentage sizes

export interface ImageBlock extends BaseBlock {
  type: 'image';
  url: string;
  alt?: string;
  caption?: string;
  size?: ImageSizePreset; // Preset sizes (pixels or percentages)
  customWidth?: string; // Custom CSS width value (e.g., "300px", "50%", "20rem")
  alignment?: 'left' | 'center' | 'right';
}

export interface ButtonBlock extends BaseBlock {
  type: 'button';
  text: string;
  url: string;
  variant?: 'default' | 'outline' | 'secondary';
  alignment?: 'left' | 'center' | 'right';
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
}

export interface SpacerBlock extends BaseBlock {
  type: 'spacer';
  height?: 'sm' | 'md' | 'lg' | 'xl'; // Predefined heights: 1rem, 2rem, 3rem, 4rem
}

export interface ListBlock extends BaseBlock {
  type: 'list';
  items: string[];
  ordered?: boolean;
}

export interface IconBlock extends BaseBlock {
  type: 'icon';
  icon: string; // Tabler icon name, e.g., 'IconCheck', 'IconUser'
  size?: 'sm' | 'md' | 'lg' | 'xl'; // 16px, 24px, 32px, 48px
  color?: string; // Tailwind color class, e.g., 'text-primary', 'text-red-500'
  alignment?: 'left' | 'center' | 'right';
}

export interface RowBlock extends BaseBlock {
  type: 'row';
  blocks: ContentBlock[]; // Blocks to display in a row
  columns?: 2 | 3 | 4; // Number of columns (default: auto based on block count)
  gap?: 'none' | 'sm' | 'md' | 'lg'; // Spacing between columns
  verticalAlign?: 'top' | 'center' | 'bottom';
}

export type ContentBlock = TextBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock | ListBlock | IconBlock | RowBlock;

export interface MessageFormData {
  title: string;
  blocks: ContentBlock[];
  targeting: {
    type: 'all' | 'specific' | 'roles';
    userIds?: string[];
    roleIds?: string[];
  };
  scheduling: {
    startDate?: Date;
    endDate?: Date;
  };
  isDraft: boolean;
}
