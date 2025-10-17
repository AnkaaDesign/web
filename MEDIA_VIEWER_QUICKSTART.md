# Media Viewer - Quick Start Guide

Get started with the Media Viewer in 5 minutes!

## 🚀 Quick Start

### Step 1: Import CSS (One-time setup)

Add to your main CSS file or `main.tsx`:

```tsx
import '@/styles/media-viewer.css';
```

### Step 2: Basic Usage

```tsx
import { MediaGallery } from '@/components/common/MediaGallery';

function MyPage() {
  const items = [
    {
      id: '1',
      type: 'image',
      url: 'https://example.com/image.jpg',
      title: 'My Image',
    },
    {
      id: '2',
      type: 'video',
      url: 'https://example.com/video.mp4',
      title: 'My Video',
    },
  ];

  return <MediaGallery items={items} />;
}
```

That's it! Click any thumbnail to open the full-screen viewer.

## 📋 Common Use Cases

### 1. Product Gallery

```tsx
function ProductPage({ product }) {
  const items = product.images.map((img) => ({
    id: img.id,
    type: 'image',
    url: img.url,
    thumbnail: img.thumbnail,
    title: product.name,
  }));

  return <MediaGallery items={items} gridCols={{ sm: 2, md: 4 }} />;
}
```

### 2. File Upload Preview

```tsx
import { filesToMediaItems } from '@/utils/mediaHelpers';

function FileUpload() {
  const [items, setItems] = useState([]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    const mediaItems = await filesToMediaItems(files);
    setItems(mediaItems);
  };

  return (
    <>
      <input type="file" multiple onChange={handleUpload} />
      {items.length > 0 && <MediaGallery items={items} />}
    </>
  );
}
```

### 3. Advanced Control

```tsx
import { MediaViewerEnhanced } from '@/components/common/MediaViewerEnhanced';
import { useMediaViewer } from '@/hooks/useMediaViewer';

function AdvancedGallery() {
  const { isOpen, currentIndex, openViewer, closeViewer } = useMediaViewer(items);

  return (
    <>
      <button onClick={() => openViewer(0)}>Open Gallery</button>

      <MediaViewerEnhanced
        items={items}
        initialIndex={currentIndex}
        isOpen={isOpen}
        onClose={closeViewer}
        options={{
          enableZoom: true,
          enableRotation: true,
          loop: true,
        }}
      />
    </>
  );
}
```

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `ESC` | Close viewer |
| `←` `→` | Navigate items |
| `+` `-` | Zoom in/out |
| `R` | Rotate image |
| `Space` | Play/pause video |
| `F` | Fullscreen |
| `D` | Download |

## 🎨 Customization

### Grid Layout

```tsx
<MediaGallery
  items={items}
  gridCols={{ sm: 2, md: 3, lg: 4, xl: 6 }}
/>
```

### Aspect Ratio

```tsx
<MediaGallery
  items={items}
  aspectRatio="video"  // "square" | "video" | "portrait" | "auto"
/>
```

### Hide Titles

```tsx
<MediaGallery items={items} showTitles={false} />
```

## 🔧 Options

```tsx
<MediaViewerEnhanced
  items={items}
  options={{
    enableKeyboard: true,    // Keyboard navigation
    enableTouch: true,       // Touch gestures
    enableZoom: true,        // Image zoom
    enableRotation: true,    // Image rotation
    enableDownload: true,    // Download button
    showThumbnails: true,    // Thumbnail strip
    autoPlay: false,         // Auto-play videos
    loop: true,              // Loop navigation
    maxZoom: 4,              // Max zoom level
    minZoom: 0.5,            // Min zoom level
    closeOnBackdropClick: true,
  }}
/>
```

## 💡 Tips

1. **Use thumbnails** for better performance:
   ```tsx
   { url: 'large.jpg', thumbnail: 'small.jpg' }
   ```

2. **Preload images** for smoother experience:
   ```tsx
   import { preloadImages } from '@/utils/mediaHelpers';
   await preloadImages([url1, url2, url3]);
   ```

3. **Sort items** before display:
   ```tsx
   import { sortMediaItems } from '@/utils/mediaHelpers';
   const sorted = sortMediaItems(items, 'date', 'desc');
   ```

4. **Filter by type**:
   ```tsx
   import { filterMediaByType } from '@/utils/mediaHelpers';
   const images = filterMediaByType(items, 'image');
   ```

## 📱 Mobile Support

The viewer is fully responsive and supports:
- ✅ Swipe left/right to navigate
- ✅ Touch-optimized controls
- ✅ Mobile-friendly UI
- ✅ Automatic layout adjustments

## 🐛 Troubleshooting

### Images not loading?
- Check CORS headers
- Verify URL accessibility
- Check browser console

### Videos not playing?
- Use MP4 or WebM format
- Check CORS headers
- Verify codec support

### Performance issues?
- Use thumbnails
- Reduce image sizes
- Limit items per page

## 📚 More Resources

- **Full Documentation**: `src/components/common/MEDIA_VIEWER_README.md`
- **Examples**: `src/components/common/MediaViewerExamples.tsx`
- **Real-world Use Cases**: `src/components/common/MediaViewerRealWorldExamples.tsx`
- **API Reference**: See README.md

## 🎯 Next Steps

1. Try the demo: `MediaViewerDemo.tsx`
2. Read full documentation
3. Check out real-world examples
4. Customize for your needs

## 🤝 Need Help?

- Check the comprehensive README
- Review the 8 real-world examples
- Explore 30+ utility functions
- See TypeScript types for full API

---

**Ready to use!** The components are production-ready with TypeScript, error handling, and full accessibility support.
