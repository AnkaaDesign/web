import type { SCHEDULE_FREQUENCY, WEEK_DAY, MONTH, MONTH_OCCURRENCE } from '../../../../constants';

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
  | 'row'
  | 'decorator'
  | 'company-asset';

export type DecoratorVariant =
  | 'header-logo'
  | 'header-logo-stripes'
  | 'footer-wave-dark'
  | 'footer-wave-logo'
  | 'footer-diagonal-stripes'
  | 'footer-wave-gold'
  | 'footer-geometric';

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  link?: string;
  color?: string; // hex color string, e.g. '#ff0000'
}

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface DecoratorBlock extends BaseBlock {
  type: 'decorator';
  variant: DecoratorVariant;
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
  mediaType?: 'image' | 'video';
  mimeType?: string;
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

export interface CompanyAssetBlock extends BaseBlock {
  type: 'company-asset';
  asset: 'logo' | 'icon';
  size?: ImageSizePreset;
  alignment?: 'left' | 'center' | 'right';
}

export type ContentBlock = TextBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock | ListBlock | IconBlock | RowBlock | DecoratorBlock | CompanyAssetBlock;

/**
 * Recorrência do comunicado. Mesma forma de dados que os agendamentos de
 * pedido/EPI/manutenção usam (`ScheduleFormData` em `@/components/ui/schedule-form`),
 * para que o payload da API seja o mesmo vocabulário em todo o sistema.
 */
export interface MessageRecurrenceFormData {
  /** Desligado = mensagem avulsa, o caminho de sempre. */
  enabled: boolean;
  frequency: SCHEDULE_FREQUENCY;
  frequencyCount?: number;
  weeklySchedule?: {
    monday?: boolean;
    tuesday?: boolean;
    wednesday?: boolean;
    thursday?: boolean;
    friday?: boolean;
    saturday?: boolean;
    sunday?: boolean;
  };
  monthlySchedule?: {
    dayOfMonth?: number | null;
    occurrence?: MONTH_OCCURRENCE | null;
    dayOfWeek?: WEEK_DAY | null;
  };
  yearlySchedule?: {
    month: MONTH;
    dayOfMonth?: number | null;
    occurrence?: MONTH_OCCURRENCE | null;
    dayOfWeek?: WEEK_DAY | null;
  };
  /** Por quantos dias cada publicação fica no feed. */
  displayDurationDays?: number;
  /** Hora de Brasília em que a publicação entra no ar. */
  publishHour?: number;
  /** Encerra o agendamento após N publicações. */
  maxOccurrences?: number | null;
}

export interface MessageFormData {
  title: string;
  blocks: ContentBlock[];
  targeting: {
    type: 'all' | 'specific' | 'sector' | 'position';
    userIds?: string[];
    sectorIds?: string[];
    positionIds?: string[];
  };
  /**
   * Com recorrência DESLIGADA: a janela de exibição da mensagem avulsa.
   * Com recorrência LIGADA: a VIGÊNCIA do agendamento (quando ele começa e
   * quando para de gerar publicações) — a janela de cada publicação passa a
   * ser `recurrence.displayDurationDays`.
   */
  scheduling: {
    startDate?: Date;
    endDate?: Date;
  };
  recurrence?: MessageRecurrenceFormData;
  isDraft: boolean;
}
