# Media Viewer Component Suite

A sophisticated full-screen modal viewer for images and videos with advanced features including zoom, pan, rotation, video controls, and keyboard navigation.

## Features

### 🖼️ Image Viewer
- **Zoom Controls**: Zoom in/out up to 4x magnification
- **Pan Support**: Drag zoomed images to view different areas
- **Rotation**: Rotate images in 90° increments
- **Mouse Wheel**: Zoom with Ctrl + scroll
- **Reset**: Quick reset to original zoom and position

### 🎥 Video Player
- **Playback Controls**: Play, pause, skip forward/backward
- **Volume Control**: Adjustable volume with mute toggle
- **Progress Bar**: Seek to any point in the video
- **Playback Speed**: Adjust speed from 0.5x to 2x
- **Fullscreen Mode**: Native fullscreen support
- **Auto-hide Controls**: Controls fade during playback

### 🎨 Gallery Navigation
- **Thumbnail Strip**: Navigate via thumbnail preview
- **Keyboard Shortcuts**: Comprehensive keyboard support
- **Touch Gestures**: Swipe left/right on mobile
- **Smooth Transitions**: Animated item changes
- **Loop Mode**: Continuous navigation option

### 🛠️ Additional Features
- **Download**: Save images/videos locally
- **Share**: Native share API support
- **Info Panel**: Display metadata and details
- **Loading States**: Shimmer effects and spinners
- **Error Handling**: Graceful error states with retry
- **Responsive Design**: Works on all screen sizes
- **Accessibility**: Full keyboard navigation and ARIA support

## Installation

The components are already integrated into your project. Simply import them:

```tsx
import { MediaViewer, MediaGallery } from '@/components/common';
import { useMediaViewer } from '@/hooks/useMediaViewer';
import type { MediaItem } from '@/types/media';
```

## Basic Usage

### Simple Gallery

```tsx
import { MediaGallery } from '@/components/common/MediaGallery';
import { MediaItem } from '@/types/media';

const MyGallery = () => {
  const items: MediaItem[] = [
    {
      id: '1',
      type: 'image',
      url: '/path/to/image.jpg',
      thumbnail: '/path/to/thumbnail.jpg',
      title: 'My Image',
    },
    {
      id: '2',
      type: 'video',
      url: '/path/to/video.mp4',
      title: 'My Video',
    },
  ];

  return <MediaGallery items={items} />;
};
```

### Manual Control

```tsx
import { MediaViewer } from '@/components/common/MediaViewer';
import { useMediaViewer } from '@/hooks/useMediaViewer';

const MyComponent = () => {
  const { isOpen, currentIndex, openViewer, closeViewer } = useMediaViewer(items);

  return (
    <>
      <button onClick={() => openViewer(0)}>Open Gallery</button>

      <MediaViewer
        items={items}
        initialIndex={currentIndex}
        isOpen={isOpen}
        onClose={closeViewer}
      />
    </>
  );
};
```

### Enhanced Features

```tsx
import { MediaViewerEnhanced } from '@/components/common/MediaViewerEnhanced';

const MyComponent = () => {
  return (
    <MediaViewerEnhanced
      items={items}
      initialIndex={0}
      isOpen={isOpen}
      onClose={onClose}
      options={{
        enableKeyboard: true,
        enableTouch: true,
        enableZoom: true,
        enableRotation: true,
        showThumbnails: true,
        autoPlay: false,
        loop: true,
        maxZoom: 4,
        minZoom: 0.5,
      }}
      onItemChange={(index, item) => console.log('Changed to:', item)}
      onDownload={(item) => handleDownload(item)}
      onShare={(item) => handleShare(item)}
    />
  );
};
```

## Component API

### MediaViewer

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `MediaItem[]` | required | Array of media items to display |
| `initialIndex` | `number` | `0` | Starting index |
| `isOpen` | `boolean` | required | Controls visibility |
| `onClose` | `() => void` | required | Close handler |

### MediaViewerEnhanced

Extends MediaViewer with additional props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `MediaGalleryOptions` | `{}` | Configuration options |
| `onItemChange` | `(index, item) => void` | - | Item change callback |
| `onDownload` | `(item) => void` | - | Custom download handler |
| `onShare` | `(item) => void` | - | Custom share handler |

### MediaGallery

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `MediaItem[]` | required | Array of media items |
| `className` | `string` | - | Additional CSS classes |
| `gridCols` | `object` | `{sm: 2, md: 3, lg: 4}` | Responsive grid columns |
| `showTitles` | `boolean` | `true` | Show item titles on hover |
| `aspectRatio` | `'square' \| 'video' \| 'portrait' \| 'auto'` | `'square'` | Thumbnail aspect ratio |

### MediaGalleryOptions

```typescript
interface MediaGalleryOptions {
  enableKeyboard?: boolean;      // Default: true
  enableTouch?: boolean;          // Default: true
  enableZoom?: boolean;           // Default: true
  enableRotation?: boolean;       // Default: true
  enableDownload?: boolean;       // Default: true
  showThumbnails?: boolean;       // Default: true
  autoPlay?: boolean;             // Default: false
  loop?: boolean;                 // Default: false
  closeOnBackdropClick?: boolean; // Default: true
  maxZoom?: number;               // Default: 4
  minZoom?: number;               // Default: 0.5
  zoomStep?: number;              // Default: 0.5
}
```

### MediaItem Interface

```typescript
interface MediaItem {
  id: string;              // Unique identifier
  type: 'image' | 'video'; // Media type
  url: string;             // Full-size URL
  thumbnail?: string;      // Optional thumbnail URL
  title?: string;          // Display title
  alt?: string;            // Alt text for images
  width?: number;          // Original width
  height?: number;         // Original height
  size?: number;           // File size in bytes
  format?: string;         // MIME type
  createdAt?: Date;        // Creation date
  metadata?: Record<string, any>; // Additional data
}
```

## Keyboard Shortcuts

### Global
- `ESC` - Close viewer
- `←` / `→` - Navigate previous/next
- `Home` - Go to first item
- `End` - Go to last item
- `I` - Toggle info panel
- `D` - Download current item

### Images
- `+` / `=` - Zoom in
- `-` - Zoom out
- `R` - Rotate 90°
- `0` - Reset zoom and position
- `Ctrl + Scroll` - Zoom with mouse wheel
- `Click + Drag` - Pan zoomed image

### Videos
- `Space` - Play/pause
- `F` - Toggle fullscreen
- `M` - Mute/unmute
- Click on video to play/pause
- Drag progress bar to seek

## Touch Gestures

- **Swipe Left** - Next item
- **Swipe Right** - Previous item
- **Pinch** - Zoom (coming soon)
- **Double Tap** - Zoom toggle (coming soon)

## Utility Functions

### Media Helpers

```typescript
import {
  detectMediaType,
  formatFileSize,
  formatDuration,
  downloadFile,
  preloadImages,
  getImageDimensions,
  createVideoThumbnail,
  fileToMediaItem,
} from '@/utils/mediaHelpers';

// Detect media type from URL
const type = detectMediaType('image.jpg'); // 'image'

// Format file size
const size = formatFileSize(1024000); // '1000 KB'

// Format video duration
const duration = formatDuration(125); // '2:05'

// Download a file
await downloadFile('/path/to/file.jpg', 'my-image.jpg');

// Preload images
await preloadImages(['/img1.jpg', '/img2.jpg']);

// Get image dimensions
const { width, height } = await getImageDimensions('/image.jpg');

// Create video thumbnail
const thumbnail = await createVideoThumbnail('/video.mp4', 1);

// Convert File to MediaItem
const mediaItem = await fileToMediaItem(file);
```

### Hook: useMediaViewer

```typescript
const {
  isOpen,        // boolean - viewer open state
  currentIndex,  // number - current item index
  openViewer,    // (index?) => void - open at index
  closeViewer,   // () => void - close viewer
  setCurrentIndex, // (index) => void - change current item
} = useMediaViewer(items);
```

## Styling

### Custom CSS

The components use Tailwind CSS classes. You can customize by:

1. **Overriding classes**: Pass custom `className` prop
2. **CSS file**: Import `/src/styles/media-viewer.css`
3. **Tailwind config**: Extend theme in `tailwind.config.js`

### CSS Variables

```css
:root {
  --media-viewer-bg: rgba(0, 0, 0, 0.95);
  --media-viewer-control-bg: rgba(0, 0, 0, 0.5);
  --media-viewer-control-hover: rgba(0, 0, 0, 0.7);
}
```

## Examples

### Product Gallery

```tsx
const ProductGallery = ({ product }) => {
  const items = product.images.map((img, i) => ({
    id: `${product.id}-${i}`,
    type: 'image' as const,
    url: img.url,
    thumbnail: img.thumbnail,
    title: `${product.name} - View ${i + 1}`,
  }));

  return (
    <MediaGallery
      items={items}
      gridCols={{ sm: 2, md: 3, lg: 4 }}
      aspectRatio="square"
    />
  );
};
```

### Video Portfolio

```tsx
const VideoPortfolio = ({ videos }) => {
  const items = videos.map(video => ({
    id: video.id,
    type: 'video' as const,
    url: video.url,
    title: video.title,
    ...video.metadata,
  }));

  return (
    <MediaGallery
      items={items}
      gridCols={{ sm: 1, md: 2 }}
      aspectRatio="video"
    />
  );
};
```

### File Upload Preview

```tsx
const FileUploadPreview = () => {
  const [files, setFiles] = useState<MediaItem[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    const mediaItems = await Promise.all(
      fileList.map(file => fileToMediaItem(file))
    );
    setFiles(mediaItems);
  };

  return (
    <>
      <input type="file" multiple onChange={handleFileChange} />
      {files.length > 0 && <MediaGallery items={files} />}
    </>
  );
};
```

### Custom Download Handler

```tsx
const CustomGallery = () => {
  const handleDownload = async (item: MediaItem) => {
    // Custom download logic
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      // Process or upload to server
      await uploadToServer(blob, item.title);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <MediaViewerEnhanced
      items={items}
      isOpen={isOpen}
      onClose={onClose}
      onDownload={handleDownload}
    />
  );
};
```

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility

- Full keyboard navigation
- ARIA labels and roles
- Screen reader announcements
- Focus management
- High contrast mode support
- Reduced motion support

## Performance Tips

1. **Use thumbnails**: Provide separate thumbnail URLs for faster gallery loading
2. **Lazy loading**: Images are loaded on-demand
3. **Preload nearby items**: Automatically preloads adjacent items
4. **Optimize images**: Use appropriate image sizes and formats (WebP)
5. **Video thumbnails**: Generate thumbnails for video items

## Troubleshooting

### Images not loading
- Check CORS headers for external images
- Verify URL accessibility
- Check browser console for errors

### Videos not playing
- Ensure video format is supported (MP4, WebM)
- Check CORS headers
- Verify video codec compatibility

### Touch gestures not working
- Ensure `enableTouch: true` in options
- Check for conflicting event handlers
- Test on actual mobile device

### Performance issues
- Reduce image sizes
- Use thumbnails for gallery
- Limit number of items
- Enable lazy loading

## License

MIT License - Part of the Ankaa Web project

## Contributing

See main project contributing guidelines.

## Changelog

### v1.0.0 (Current)
- Initial release
- Basic image and video viewer
- Keyboard navigation
- Touch support
- Thumbnail gallery
- Enhanced version with advanced features

## Support

For issues or questions, please file an issue in the main repository.
