# Message Block Renderer

A comprehensive React component for rendering rich message content blocks with full TypeScript support, accessibility features, and design system integration.

## Features

- **Multiple Block Types**: Headings, paragraphs, images, buttons, dividers, lists, and quotes
- **Inline Formatting**: Support for bold, italic, and links within text blocks
- **Fully Responsive**: Works seamlessly across all device sizes
- **Accessible**: Proper semantic HTML, ARIA labels, and keyboard navigation
- **Type-Safe**: Complete TypeScript typing for all components and props
- **Design System Integration**: Uses your existing Tailwind theme and component library
- **Performance Optimized**: React.memo for efficient re-renders, lazy loading for images

## Installation

The component is already set up in your project at `/src/components/messaging/`. Simply import and use:

```tsx
import { MessageBlockRenderer } from '@/components/messaging';
import type { MessageBlock } from '@/components/messaging';
```

## Usage

### Basic Example

```tsx
import { MessageBlockRenderer } from '@/components/messaging';
import type { MessageBlock } from '@/components/messaging';

const MyComponent = () => {
  const blocks: MessageBlock[] = [
    {
      type: 'heading',
      level: 1,
      content: 'Welcome!',
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', content: 'This is a simple paragraph.' },
      ],
    },
  ];

  return <MessageBlockRenderer blocks={blocks} />;
};
```

### Advanced Example with All Block Types

```tsx
const blocks: MessageBlock[] = [
  // Heading
  {
    type: 'heading',
    level: 1,
    content: 'Main Title',
    id: 'main-title',
  },

  // Paragraph with inline formatting
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'This is ' },
      { type: 'bold', content: 'bold text' },
      { type: 'text', content: ', ' },
      { type: 'italic', content: 'italic text' },
      { type: 'text', content: ', and ' },
      { type: 'link', content: 'a link', url: 'https://example.com' },
    ],
  },

  // Unordered list
  {
    type: 'list',
    ordered: false,
    items: [
      [{ type: 'text', content: 'First item' }],
      [{ type: 'text', content: 'Second item with ' }, { type: 'bold', content: 'bold' }],
      [{ type: 'text', content: 'Third item' }],
    ],
  },

  // Ordered list
  {
    type: 'list',
    ordered: true,
    items: [
      [{ type: 'text', content: 'Step one' }],
      [{ type: 'text', content: 'Step two' }],
    ],
  },

  // Divider
  {
    type: 'divider',
  },

  // Quote with author
  {
    type: 'quote',
    content: [
      { type: 'text', content: 'To be or not to be, that is the question.' },
    ],
    author: 'William Shakespeare',
  },

  // Image with caption
  {
    type: 'image',
    src: 'https://example.com/image.jpg',
    alt: 'Description of the image',
    caption: 'Optional caption text',
    width: 800,
    height: 400,
  },

  // Button with click handler
  {
    type: 'button',
    text: 'Click Me',
    variant: 'default',
    onClick: () => console.log('Clicked!'),
  },

  // Button as link
  {
    type: 'button',
    text: 'Visit Site',
    variant: 'outline',
    url: 'https://example.com',
  },
];

<MessageBlockRenderer blocks={blocks} className="custom-class" />
```

## Block Types

### HeadingBlock

```typescript
{
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content: string;
  id?: string;
}
```

### ParagraphBlock

```typescript
{
  type: 'paragraph';
  content: InlineFormat[];
  id?: string;
}
```

### ImageBlock

```typescript
{
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  id?: string;
}
```

Features:
- Lazy loading
- Loading state
- Error handling with fallback UI
- Responsive sizing

### ButtonBlock

```typescript
{
  type: 'button';
  text: string;
  url?: string;
  onClick?: () => void;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  id?: string;
}
```

Use `url` for link buttons or `onClick` for action buttons.

### DividerBlock

```typescript
{
  type: 'divider';
  id?: string;
}
```

### ListBlock

```typescript
{
  type: 'list';
  ordered: boolean;
  items: InlineFormat[][];
  id?: string;
}
```

Set `ordered: true` for numbered lists, `false` for bullet lists.

### QuoteBlock

```typescript
{
  type: 'quote';
  content: InlineFormat[];
  author?: string;
  id?: string;
}
```

## Inline Formatting

All text content uses the `InlineFormat` type:

```typescript
type InlineFormat =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'link'; content: string; url: string };
```

You can mix multiple inline formats:

```typescript
content: [
  { type: 'text', content: 'Normal text ' },
  { type: 'bold', content: 'bold text' },
  { type: 'text', content: ' and ' },
  { type: 'italic', content: 'italic text' },
  { type: 'text', content: ' with ' },
  { type: 'link', content: 'a link', url: 'https://example.com' },
]
```

## Individual Components

You can also use individual block components directly:

```tsx
import {
  HeadingBlock,
  ParagraphBlock,
  ImageBlock,
  ButtonBlock,
  DividerBlock,
  ListBlock,
  QuoteBlock,
} from '@/components/messaging';

<HeadingBlock block={{ type: 'heading', level: 1, content: 'Title' }} />
<ParagraphBlock block={{ type: 'paragraph', content: [...] }} />
// ... etc
```

## Accessibility

The component follows accessibility best practices:

- Semantic HTML elements (`article`, `h1-h6`, `p`, `ul`, `ol`, `blockquote`, etc.)
- ARIA labels where appropriate
- Proper heading hierarchy
- Accessible links with `rel="noopener noreferrer"` for external links
- Focus states with visible focus rings
- Alt text required for images
- Loading states announced to screen readers

## Styling

The components use your existing design system:

- Tailwind CSS classes
- CSS custom properties from your theme
- Responsive breakpoints
- Dark mode support
- Consistent spacing and typography

To customize, you can:

1. Pass `className` prop to override styles
2. Modify the component files directly
3. Use Tailwind's configuration to adjust theme values

## Performance

- Components are wrapped in `React.memo` for optimized re-renders
- Images use lazy loading
- Type-safe rendering prevents runtime errors
- Minimal re-renders with proper key usage

## Demo

To see all features in action, check out the demo component:

```tsx
import { MessageBlockRendererDemo } from '@/components/messaging/MessageBlockRendererDemo';

<MessageBlockRendererDemo />
```

## TypeScript Support

All types are exported for your convenience:

```tsx
import type {
  MessageBlock,
  HeadingBlockType,
  ParagraphBlockType,
  ImageBlockType,
  ButtonBlockType,
  DividerBlockType,
  ListBlockType,
  QuoteBlockType,
  InlineFormat,
  MessageBlockRendererProps,
} from '@/components/messaging';
```

## File Structure

```
src/components/messaging/
├── MessageBlockRenderer.tsx    # Main renderer component
├── HeadingBlock.tsx           # Heading component
├── ParagraphBlock.tsx         # Paragraph component
├── ImageBlock.tsx             # Image component
├── ButtonBlock.tsx            # Button component
├── DividerBlock.tsx           # Divider component
├── ListBlock.tsx              # List component
├── QuoteBlock.tsx             # Quote component
├── InlineContent.tsx          # Inline formatting renderer
├── types.ts                   # TypeScript types
├── index.ts                   # Public exports
├── MessageBlockRendererDemo.tsx # Demo/example component
└── README.md                  # This file
```

## Browser Support

Works in all modern browsers that support:
- ES6+
- CSS Grid and Flexbox
- CSS Custom Properties
- IntersectionObserver (for lazy loading)

## License

Part of the Ankaa web application.
