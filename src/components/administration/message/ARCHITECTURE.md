# Message Editor Architecture

## Visual Component Tree

```
┌─────────────────────────────────────────────────────────────────┐
│                     CreateMessagePage                            │
│  - Page header with actions                                     │
│  - Breadcrumbs navigation                                       │
│  - Preview button handler                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MessageEditor                               │
│  - Manages form state                                           │
│  - Validates data                                               │
│  - Exposes getData() for preview                                │
└──────────────┬────────────────────────┬─────────────────────────┘
               │                        │
               ▼                        ▼
    ┌──────────────────┐    ┌──────────────────────┐
    │  Content Tab     │    │   Settings Tab       │
    └────────┬─────────┘    └──────────┬───────────┘
             │                         │
             ▼                         ▼
┌────────────────────────┐  ┌─────────────────────────────┐
│ BlockEditorCanvas      │  │  MessageMetadataForm        │
│ - Drag & drop context │  │  - Title                    │
│ - Add block button     │  │  - Priority selector        │
│ - Block list           │  │  - User targeting (tabs)    │
└──────┬─────────────────┘  │  - Date scheduling          │
       │                    └─────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│        DndContext (from @dnd-kit)                    │
│  ┌──────────────────────────────────────────────┐   │
│  │     SortableContext                          │   │
│  │  ┌──────────────────────────────────────┐   │   │
│  │  │  BlockEditor (repeated for each)     │   │   │
│  │  │  ┌──────────────────────────────┐    │   │   │
│  │  │  │  Drag Handle (grip icon)     │    │   │   │
│  │  │  ├──────────────────────────────┤    │   │   │
│  │  │  │  Block Content Area:         │    │   │   │
│  │  │  │  ┌─────────────────────────┐ │    │   │   │
│  │  │  │  │ TextBlockEditor         │ │    │   │   │
│  │  │  │  │ - Textarea with styles  │ │    │   │   │
│  │  │  │  │ - Inline toolbar        │ │    │   │   │
│  │  │  │  └─────────────────────────┘ │    │   │   │
│  │  │  │  ┌─────────────────────────┐ │    │   │   │
│  │  │  │  │ ImageBlockEditor        │ │    │   │   │
│  │  │  │  │ - Upload button         │ │    │   │   │
│  │  │  │  │ - URL input             │ │    │   │   │
│  │  │  │  │ - Alignment controls    │ │    │   │   │
│  │  │  │  └─────────────────────────┘ │    │   │   │
│  │  │  │  ┌─────────────────────────┐ │    │   │   │
│  │  │  │  │ ButtonBlockEditor       │ │    │   │   │
│  │  │  │  │ - Text input            │ │    │   │   │
│  │  │  │  │ - URL input             │ │    │   │   │
│  │  │  │  │ - Style selector        │ │    │   │   │
│  │  │  │  └─────────────────────────┘ │    │   │   │
│  │  │  │  ┌─────────────────────────┐ │    │   │   │
│  │  │  │  │ ListBlockEditor         │ │    │   │   │
│  │  │  │  │ - Item inputs           │ │    │   │   │
│  │  │  │  │ - Add/remove items      │ │    │   │   │
│  │  │  │  │ - Ordered toggle        │ │    │   │   │
│  │  │  │  └─────────────────────────┘ │    │   │   │
│  │  │  │  ┌─────────────────────────┐ │    │   │   │
│  │  │  │  │ DividerBlockEditor      │ │    │   │   │
│  │  │  │  │ - Horizontal line       │ │    │   │   │
│  │  │  │  └─────────────────────────┘ │    │   │   │
│  │  │  ├──────────────────────────────┤    │   │   │
│  │  │  │  Action Buttons:             │    │   │   │
│  │  │  │  [+ Insert] [🗑️ Delete]      │    │   │   │
│  │  │  └──────────────────────────────┘    │   │   │
│  │  └──────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│ BlockTypeSelector Dialog │
│ - Grid of block types    │
│ - Icons & descriptions   │
└──────────────────────────┘
```

## Data Flow

```
┌─────────────────┐
│  User Actions   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  MessageEditor (State Container)    │
│  ┌────────────┐  ┌──────────────┐  │
│  │  blocks[]  │  │  metadata{}  │  │
│  └─────┬──────┘  └──────┬───────┘  │
└────────┼────────────────┼──────────┘
         │                │
         │                │
    ┌────▼─────┐    ┌────▼────────┐
    │ Content  │    │  Settings   │
    │   Tab    │    │     Tab     │
    └────┬─────┘    └────┬────────┘
         │               │
         ▼               ▼
    ┌─────────────┐  ┌────────────────┐
    │   Canvas    │  │  Metadata Form │
    │             │  │                │
    │  onChange:  │  │   onChange:    │
    │  setBlocks  │  │  setMetadata   │
    └─────────────┘  └────────────────┘
         │
         ▼
    Individual Blocks
    (TextBlock, ImageBlock, etc.)
         │
         ▼
    onUpdate(partial)
         │
         ▼
    Parent updates block in array
```

## Event Flow: Adding a Block

```
1. User clicks "+ Add Block"
   │
   ▼
2. BlockEditorCanvas sets showTypeSelector = true
   │
   ▼
3. BlockTypeSelector dialog opens
   │
   ▼
4. User selects block type (e.g., "Paragraph")
   │
   ▼
5. BlockTypeSelector calls onSelect('paragraph')
   │
   ▼
6. BlockEditorCanvas.handleAddBlock()
   │
   ▼
7. createEmptyBlock('paragraph') creates new block
   │
   ▼
8. onBlocksChange([...blocks, newBlock])
   │
   ▼
9. MessageEditor updates state
   │
   ▼
10. BlockEditorCanvas re-renders with new block
```

## Event Flow: Drag and Drop

```
1. User grabs drag handle
   │
   ▼
2. @dnd-kit activates drag
   │
   ▼
3. User drags over another block
   │
   ▼
4. Visual feedback shows drop position
   │
   ▼
5. User releases
   │
   ▼
6. onDragEnd event fires
   │
   ▼
7. handleDragEnd calculates new positions
   │
   ▼
8. arrayMove(blocks, oldIndex, newIndex)
   │
   ▼
9. onBlocksChange(reorderedBlocks)
   │
   ▼
10. Blocks re-render in new order
```

## Event Flow: Inline Formatting

```
1. User selects text in TextBlockEditor
   │
   ▼
2. handleSelectionChange() captures selection
   │
   ▼
3. InlineFormattingToolbar appears
   │
   ▼
4. User clicks Bold button
   │
   ▼
5. handleFormat('bold') wraps text in **
   │
   ▼
6. Updates block content
   │
   ▼
7. onUpdate({ content: newContent })
   │
   ▼
8. Parent BlockEditor receives update
   │
   ▼
9. Calls onUpdate on BlockEditorCanvas
   │
   ▼
10. Updates block in blocks array
```

## State Management Strategy

### Local State (useState)
- `blocks` - Array of content blocks
- `metadata` - Message metadata (title, targeting, etc.)
- `activeTab` - Current tab (content/settings)
- `showTypeSelector` - Block selector dialog visibility
- `selection` - Text selection in formatting toolbar

### Derived State
- `isValid` - Computed from title and blocks
- `isDirty` - Computed from changes

### Props Drilling
- Deep: MessageEditor → Canvas → BlockEditor → Specific Block
- Uses callback props for updates
- Each level is responsible for its own state

### Why Not Context?
- State is localized to editor
- Prop drilling is only 3-4 levels deep
- Performance is good without optimization
- Easier to debug and test

## Performance Optimizations

### Current
- React.memo on ActionButton
- React.memo on ActionsDropdown
- Callback refs for stable functions
- Virtual DOM diffing

### Future Considerations
- Virtual scrolling for 100+ blocks
- Debounced auto-save
- Code splitting for block editors
- Lazy loading of preview dialog

## Type Safety

### Strong Typing
- All blocks have discriminated union types
- Type guards for block type checking
- Full type coverage in forms

### Runtime Validation
- Form validation on submit
- File type checking on upload
- URL validation for links

## Extensibility Points

### Adding New Blocks
1. Add type to `BlockType` union
2. Create interface extending `BaseBlock`
3. Add to `ContentBlock` union
4. Create block editor component
5. Add to switch in `BlockEditor`
6. Add to `blockTypes` array in selector
7. Add to `createEmptyBlock` switch

### Adding New Metadata
1. Update `MessageFormData` interface
2. Add fields to `MessageMetadataForm`
3. Update initial state in `MessageEditor`
4. Update preview rendering

### Custom Styling
- All components use Tailwind classes
- shadcn/ui theming via CSS variables
- Can override at component level

## Testing Strategy

### Unit Tests
- Individual block editors
- Utility functions
- Type guards

### Integration Tests
- Block creation flow
- Drag and drop
- Form validation
- Preview rendering

### E2E Tests
- Full message creation
- Draft → Publish workflow
- Edit existing message
- Image upload flow
