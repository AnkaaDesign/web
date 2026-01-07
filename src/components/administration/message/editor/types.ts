export type BlockType =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'paragraph'
  | 'image'
  | 'button'
  | 'divider'
  | 'list'
  | 'quote';

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
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  url: string;
  alt?: string;
  caption?: string;
  width?: number;
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

export interface ListBlock extends BaseBlock {
  type: 'list';
  items: string[];
  ordered?: boolean;
}

export type ContentBlock = TextBlock | ImageBlock | ButtonBlock | DividerBlock | ListBlock;

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
  priority: 'low' | 'normal' | 'high';
  isDraft: boolean;
}
