# Visual Message Editor

A comprehensive block-based visual editor for creating rich messages in the admin interface.

## Features

### 1. Visual Block-Based Editor
- Notion-style block editing
- No HTML/Markdown knowledge required
- WYSIWYG editing experience

### 2. Drag and Drop
- Reorder blocks via drag and drop
- Powered by `@dnd-kit` for smooth animations
- Keyboard navigation support

### 3. Block Types

#### Text Blocks
- **Heading 1**: Main titles
- **Heading 2**: Subtitles
- **Heading 3**: Smaller headings
- **Paragraph**: Regular text
- **Quote**: Blockquote styling

#### Media Blocks
- **Image**: Upload or URL with caption, alignment, and alt text

#### Interactive Blocks
- **Button**: Call-to-action with customizable style and link
- **List**: Ordered or unordered lists
- **Divider**: Horizontal separator

### 4. Inline Formatting Toolbar
- Bold, italic, underline
- Add links to selected text
- Appears on text selection

### 5. Image Upload
- File upload support
- URL input option
- Image alignment (left, center, right)
- Optional caption and alt text

### 6. User Targeting
- **All Users**: Broadcast to everyone
- **Specific Users**: Select individual users
- **Roles**: Target by user role/position

### 7. Scheduling
- Start date: When message becomes visible
- End date: When message expires
- Optional - leave blank for indefinite display

### 8. Priority Settings
- **Low**: Informational
- **Normal**: Standard importance
- **High**: Urgent/important

### 9. Draft/Publish Workflow
- Save as draft for later editing
- Publish immediately
- Status indicators

### 10. Preview Functionality
- See exactly how the message will appear
- Review all metadata
- Test before publishing

## File Structure

```
src/
├── pages/administration/messages/
│   ├── index.tsx                 # Export file
│   ├── create.tsx                # Create message page
│   ├── list.tsx                  # List all messages
│   └── edit/[id].tsx            # Edit message page
│
└── components/administration/message/
    ├── README.md                 # This file
    └── editor/
        ├── types.ts              # TypeScript types
        ├── message-editor.tsx    # Main editor component
        ├── block-editor-canvas.tsx          # Canvas with drag-drop
        ├── block-editor.tsx                 # Individual block wrapper
        ├── block-type-selector.tsx          # Block type picker dialog
        ├── inline-formatting-toolbar.tsx    # Text formatting toolbar
        ├── message-metadata-form.tsx        # Targeting & scheduling
        ├── message-preview-dialog.tsx       # Preview modal
        └── blocks/
            ├── text-block-editor.tsx        # Text & headings
            ├── image-block-editor.tsx       # Image block
            ├── button-block-editor.tsx      # Button/CTA block
            ├── list-block-editor.tsx        # List block
            └── divider-block-editor.tsx     # Divider block
```

## Usage

### Creating a Message

```tsx
import { CreateMessagePage } from '@/pages/administration/messages';

// The page handles all state and form logic
<CreateMessagePage />
```

### Using the Editor Component

```tsx
import { MessageEditor } from '@/components/administration/message/editor/message-editor';

const MyComponent = () => {
  const handleSubmit = (data: MessageFormData, isDraft: boolean) => {
    // Save to API
    console.log('Message data:', data);
    console.log('Is draft:', isDraft);
  };

  return (
    <MessageEditor
      onSubmit={handleSubmit}
      onFormStateChange={(state) => {
        console.log('Valid:', state.isValid);
        console.log('Dirty:', state.isDirty);
      }}
    />
  );
};
```

## Data Structure

### MessageFormData

```typescript
interface MessageFormData {
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
```

### Block Types

```typescript
type ContentBlock =
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | ListBlock;
```

## Integration Points

### API Endpoints (To Implement)

```typescript
// Create message
POST /api/messages
Body: MessageFormData

// Update message
PUT /api/messages/:id
Body: MessageFormData

// Get message
GET /api/messages/:id

// List messages
GET /api/messages
Query: { status?: 'draft' | 'published', page?: number }

// Upload image
POST /api/messages/upload
Body: FormData with file
```

### Routes Configuration

Add to `src/constants/routes.ts`:

```typescript
export const routes = {
  // ... existing routes
  administration: {
    // ... existing admin routes
    messages: {
      root: '/administration/messages',
      create: '/administration/messages/create',
      edit: (id: string) => `/administration/messages/edit/${id}`,
    },
  },
};
```

Add to `src/constants/favorites.ts`:

```typescript
export enum FAVORITE_PAGES {
  // ... existing pages
  ADMINISTRACAO_MENSAGENS = "ADMINISTRACAO_MENSAGENS",
  ADMINISTRACAO_MENSAGENS_CRIAR = "ADMINISTRACAO_MENSAGENS_CRIAR",
  ADMINISTRACAO_MENSAGENS_EDITAR = "ADMINISTRACAO_MENSAGENS_EDITAR",
}
```

## Customization

### Adding New Block Types

1. Add type to `types.ts`:
```typescript
export type BlockType = 'heading1' | 'paragraph' | 'yourNewType';

export interface YourNewBlock extends BaseBlock {
  type: 'yourNewType';
  // your fields
}
```

2. Create block editor in `blocks/your-new-block-editor.tsx`

3. Update `block-editor.tsx` to render your block

4. Add to `block-type-selector.tsx`

### Styling

All components use Tailwind CSS and shadcn/ui components. Customize by:

1. Editing component classes
2. Updating theme in `tailwind.config.js`
3. Modifying shadcn/ui component variants

## Dependencies

Required packages (already in package.json):

- `@dnd-kit/core` - Drag and drop
- `@dnd-kit/sortable` - Sortable lists
- `@dnd-kit/utilities` - DnD utilities
- `@radix-ui/*` - UI primitives
- `date-fns` - Date formatting
- `@tabler/icons-react` - Icons

## Accessibility

- Keyboard navigation for drag and drop
- ARIA labels on interactive elements
- Semantic HTML structure
- Focus management in dialogs
- Screen reader friendly

## Future Enhancements

- [ ] Rich text editing (contenteditable)
- [ ] Code block support
- [ ] Embed support (videos, iframes)
- [ ] Templates system
- [ ] Duplicate message
- [ ] Version history
- [ ] Collaborative editing
- [ ] Real-time preview
- [ ] A/B testing variants
- [ ] Analytics tracking
- [ ] Email export
- [ ] PDF export

## Testing

Example test structure:

```tsx
import { render, screen } from '@testing-library/react';
import { MessageEditor } from './message-editor';

describe('MessageEditor', () => {
  it('renders without crashing', () => {
    render(<MessageEditor onSubmit={jest.fn()} />);
    expect(screen.getByText('Editor de Conteúdo')).toBeInTheDocument();
  });

  it('validates required fields', () => {
    const handleFormStateChange = jest.fn();
    render(
      <MessageEditor
        onSubmit={jest.fn()}
        onFormStateChange={handleFormStateChange}
      />
    );

    // Should be invalid initially (no title, no blocks)
    expect(handleFormStateChange).toHaveBeenCalledWith({
      isValid: false,
      isDirty: false,
    });
  });
});
```

## Support

For issues or questions:
1. Check this README
2. Review the type definitions in `types.ts`
3. Examine existing block implementations
4. Refer to shadcn/ui documentation for UI components
