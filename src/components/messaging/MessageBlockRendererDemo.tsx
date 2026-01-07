import * as React from "react";
import { MessageBlockRenderer } from "./MessageBlockRenderer";
import type { MessageBlock } from "./types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Demo component showcasing all MessageBlockRenderer features
 * This demonstrates how to use the component with various block types
 */
export const MessageBlockRendererDemo: React.FC = () => {
  const sampleBlocks: MessageBlock[] = [
    {
      type: 'heading',
      level: 1,
      content: 'Welcome to Message Block Renderer',
      id: 'main-title',
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', content: 'This component supports ' },
        { type: 'bold', content: 'rich text formatting' },
        { type: 'text', content: ' with ' },
        { type: 'italic', content: 'multiple styles' },
        { type: 'text', content: ' and ' },
        { type: 'link', content: 'clickable links', url: 'https://example.com' },
        { type: 'text', content: '.' },
      ],
    },
    {
      type: 'heading',
      level: 2,
      content: 'Features',
      id: 'features',
    },
    {
      type: 'list',
      ordered: false,
      items: [
        [{ type: 'text', content: 'Semantic HTML for accessibility' }],
        [{ type: 'text', content: 'Responsive design that works on all devices' }],
        [{ type: 'text', content: 'Full TypeScript support with type safety' }],
        [
          { type: 'text', content: 'Integration with the ' },
          { type: 'bold', content: 'design system' },
        ],
        [{ type: 'text', content: 'Support for dark and light themes' }],
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'heading',
      level: 3,
      content: 'Block Types',
      id: 'block-types',
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', content: 'The renderer supports the following block types:' },
      ],
    },
    {
      type: 'list',
      ordered: true,
      items: [
        [{ type: 'bold', content: 'Headings' }, { type: 'text', content: ' (H1 through H6)' }],
        [{ type: 'bold', content: 'Paragraphs' }, { type: 'text', content: ' with inline formatting' }],
        [{ type: 'bold', content: 'Images' }, { type: 'text', content: ' with captions and lazy loading' }],
        [{ type: 'bold', content: 'Buttons' }, { type: 'text', content: ' with multiple variants' }],
        [{ type: 'bold', content: 'Dividers' }, { type: 'text', content: ' for content separation' }],
        [{ type: 'bold', content: 'Lists' }, { type: 'text', content: ' (ordered and unordered)' }],
        [{ type: 'bold', content: 'Quotes' }, { type: 'text', content: ' with optional attribution' }],
      ],
    },
    {
      type: 'quote',
      content: [
        {
          type: 'text',
          content: 'Good design is as little design as possible.',
        },
      ],
      author: 'Dieter Rams',
    },
    {
      type: 'heading',
      level: 3,
      content: 'Interactive Elements',
      id: 'interactive',
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', content: 'You can add interactive buttons with different styles:' },
      ],
    },
    {
      type: 'button',
      text: 'Primary Button',
      variant: 'default',
      onClick: () => alert('Primary button clicked!'),
    },
    {
      type: 'button',
      text: 'Secondary Button',
      variant: 'secondary',
      onClick: () => alert('Secondary button clicked!'),
    },
    {
      type: 'button',
      text: 'Visit Example',
      variant: 'outline',
      url: 'https://example.com',
    },
    {
      type: 'divider',
    },
    {
      type: 'heading',
      level: 3,
      content: 'Image Support',
      id: 'images',
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', content: 'Images are displayed with lazy loading and error handling:' },
      ],
    },
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=800&h=400&fit=crop',
      alt: 'Abstract gradient background',
      caption: 'A beautiful gradient demonstrating image support with captions',
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Message Block Renderer Demo</CardTitle>
          <CardDescription>
            Explore all the features of the MessageBlockRenderer component
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MessageBlockRenderer blocks={sampleBlocks} />
        </CardContent>
      </Card>

      {/* Usage Example */}
      <Card className="mt-8" level={2}>
        <CardHeader>
          <CardTitle>Usage Example</CardTitle>
          <CardDescription>
            Here's how to use the MessageBlockRenderer in your code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            <code>{`import { MessageBlockRenderer } from '@/components/messaging';
import type { MessageBlock } from '@/components/messaging';

const blocks: MessageBlock[] = [
  {
    type: 'heading',
    level: 1,
    content: 'Hello World',
  },
  {
    type: 'paragraph',
    content: [
      { type: 'text', content: 'This is ' },
      { type: 'bold', content: 'bold text' },
      { type: 'text', content: ' and ' },
      { type: 'link', content: 'a link', url: 'https://example.com' },
    ],
  },
];

<MessageBlockRenderer blocks={blocks} />`}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};
