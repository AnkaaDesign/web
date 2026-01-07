// Main editor
export { MessageEditor } from './message-editor';

// Supporting components
export { BlockEditorCanvas } from './block-editor-canvas';
export { BlockEditor } from './block-editor';
export { BlockTypeSelector } from './block-type-selector';
export { InlineFormattingToolbar } from './inline-formatting-toolbar';
export { MessageMetadataForm } from './message-metadata-form';
export { MessagePreviewDialog } from './message-preview-dialog';

// Block editors
export { TextBlockEditor } from './blocks/text-block-editor';
export { ImageBlockEditor } from './blocks/image-block-editor';
export { ButtonBlockEditor } from './blocks/button-block-editor';
export { ListBlockEditor } from './blocks/list-block-editor';
export { DividerBlockEditor } from './blocks/divider-block-editor';

// Types
export type {
  BlockType,
  TextStyle,
  BaseBlock,
  TextBlock,
  ImageBlock,
  ButtonBlock,
  DividerBlock,
  ListBlock,
  ContentBlock,
  MessageFormData,
} from './types';
