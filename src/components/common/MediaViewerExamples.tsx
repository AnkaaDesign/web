import React, { useState } from 'react';
import { MediaViewer, MediaItem } from './MediaViewer';
import { MediaViewerEnhanced } from './MediaViewerEnhanced';
import { MediaGallery } from './MediaGallery';
import { useMediaViewer } from '@/hooks/useMediaViewer';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Comprehensive examples of media viewer usage
 */
export const MediaViewerExamples: React.FC = () => {
  const [selectedExample, setSelectedExample] = useState<string>('basic');

  // Example 1: Basic Image Gallery
  const imageGallery: MediaItem[] = [
    {
      id: '1',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
      thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200',
      title: 'Mountain Landscape',
    },
    {
      id: '2',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e',
      thumbnail: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200',
      title: 'Forest Path',
    },
  ];

  // Example 2: Mixed Media
  const mixedMedia: MediaItem[] = [
    ...imageGallery,
    {
      id: '3',
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      title: 'Big Buck Bunny',
    },
  ];

  // Example 3: Product Photos
  const productPhotos: MediaItem[] = [
    {
      id: 'p1',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
      title: 'Product View 1',
    },
    {
      id: 'p2',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
      title: 'Product View 2',
    },
  ];

  const basicGallery = useMediaViewer(imageGallery);
  const mixedGallery = useMediaViewer(mixedMedia);
  const productGallery = useMediaViewer(productPhotos);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Media Viewer Examples</h1>
        <p className="text-gray-600 mb-8">
          Comprehensive examples showing different use cases and configurations
        </p>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="mb-8">
            <TabsTrigger value="basic">Basic Gallery</TabsTrigger>
            <TabsTrigger value="mixed">Mixed Media</TabsTrigger>
            <TabsTrigger value="enhanced">Enhanced Features</TabsTrigger>
            <TabsTrigger value="custom">Custom Layouts</TabsTrigger>
          </TabsList>

          {/* Basic Gallery Example */}
          <TabsContent value="basic" className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-2xl font-semibold mb-4">Basic Image Gallery</h2>
              <p className="text-gray-600 mb-6">
                Simple image gallery with default settings
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {imageGallery.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => basicGallery.openViewer(index)}
                    className="aspect-square rounded-lg overflow-hidden hover:shadow-sm transition-shadow"
                  >
                    <img
                      src={item.thumbnail || item.url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>

              <div className="bg-gray-50 rounded p-4">
                <h3 className="font-semibold mb-2">Code Example:</h3>
                <pre className="text-sm overflow-x-auto">
                  <code>{`const gallery = useMediaViewer(items);

<button onClick={() => gallery.openViewer(0)}>
  Open Gallery
</button>

<MediaViewer
  items={items}
  initialIndex={gallery.currentIndex}
  isOpen={gallery.isOpen}
  onClose={gallery.closeViewer}
/>`}</code>
                </pre>
              </div>

              <MediaViewer
                items={imageGallery}
                initialIndex={basicGallery.currentIndex}
                isOpen={basicGallery.isOpen}
                onClose={basicGallery.closeViewer}
              />
            </div>
          </TabsContent>

          {/* Mixed Media Example */}
          <TabsContent value="mixed" className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-2xl font-semibold mb-4">Mixed Media Gallery</h2>
              <p className="text-gray-600 mb-6">
                Gallery with both images and videos
              </p>

              <MediaGallery
                items={mixedMedia}
                gridCols={{ sm: 2, md: 3, lg: 4 }}
                className="mb-6"
              />

              <div className="bg-gray-50 rounded p-4">
                <h3 className="font-semibold mb-2">Code Example:</h3>
                <pre className="text-sm overflow-x-auto">
                  <code>{`<MediaGallery
  items={mixedMedia}
  gridCols={{ sm: 2, md: 3, lg: 4 }}
  showTitles={true}
  aspectRatio="square"
/>`}</code>
                </pre>
              </div>
            </div>
          </TabsContent>

          {/* Enhanced Features Example */}
          <TabsContent value="enhanced" className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-2xl font-semibold mb-4">Enhanced Media Viewer</h2>
              <p className="text-gray-600 mb-6">
                Advanced features including playback speed, info panel, and more
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {mixedMedia.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => mixedGallery.openViewer(index)}
                    className="aspect-square rounded-lg overflow-hidden hover:shadow-sm transition-shadow relative group"
                  >
                    <img
                      src={item.thumbnail || item.url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.title}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Additional Features:</h3>
                  <ul className="text-sm space-y-1">
                    <li>✓ Playback speed control</li>
                    <li>✓ Info panel with metadata</li>
                    <li>✓ Share functionality</li>
                    <li>✓ Skip forward/backward 10s</li>
                    <li>✓ Loop mode</li>
                    <li>✓ Custom callbacks</li>
                  </ul>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Keyboard Shortcuts:</h3>
                  <ul className="text-sm space-y-1">
                    <li><kbd className="bg-white px-2 py-0.5 rounded">I</kbd> - Toggle info</li>
                    <li><kbd className="bg-white px-2 py-0.5 rounded">D</kbd> - Download</li>
                    <li><kbd className="bg-white px-2 py-0.5 rounded">F</kbd> - Fullscreen</li>
                    <li><kbd className="bg-white px-2 py-0.5 rounded">0</kbd> - Reset zoom</li>
                    <li><kbd className="bg-white px-2 py-0.5 rounded">Home</kbd> - First item</li>
                    <li><kbd className="bg-white px-2 py-0.5 rounded">End</kbd> - Last item</li>
                  </ul>
                </div>
              </div>

              <div className="bg-gray-50 rounded p-4">
                <h3 className="font-semibold mb-2">Code Example:</h3>
                <pre className="text-sm overflow-x-auto">
                  <code>{`<MediaViewerEnhanced
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
  onItemChange={(index, item) => {}}
  onDownload={(item) => {}}
  onShare={(item) => {}}
/>`}</code>
                </pre>
              </div>

              <MediaViewerEnhanced
                items={mixedMedia}
                initialIndex={mixedGallery.currentIndex}
                isOpen={mixedGallery.isOpen}
                onClose={mixedGallery.closeViewer}
                options={{
                  enableKeyboard: true,
                  enableTouch: true,
                  enableZoom: true,
                  enableRotation: true,
                  showThumbnails: true,
                  autoPlay: false,
                  loop: true,
                }}
                onItemChange={(index, item) => {}}
              />
            </div>
          </TabsContent>

          {/* Custom Layouts Example */}
          <TabsContent value="custom" className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-2xl font-semibold mb-4">Custom Layouts</h2>
              <p className="text-gray-600 mb-6">
                Different grid layouts and aspect ratios
              </p>

              <div className="space-y-8">
                {/* Square Grid */}
                <div>
                  <h3 className="font-semibold mb-3">Square Thumbnails</h3>
                  <MediaGallery
                    items={productPhotos}
                    gridCols={{ sm: 2, md: 4, lg: 6 }}
                    aspectRatio="square"
                  />
                </div>

                {/* Video Aspect Ratio */}
                <div>
                  <h3 className="font-semibold mb-3">16:9 Aspect Ratio</h3>
                  <MediaGallery
                    items={imageGallery}
                    gridCols={{ sm: 1, md: 2 }}
                    aspectRatio="video"
                  />
                </div>

                {/* Portrait Layout */}
                <div>
                  <h3 className="font-semibold mb-3">Portrait Layout</h3>
                  <MediaGallery
                    items={productPhotos}
                    gridCols={{ sm: 2, md: 3, lg: 4 }}
                    aspectRatio="portrait"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded p-4 mt-6">
                <h3 className="font-semibold mb-2">Layout Options:</h3>
                <pre className="text-sm overflow-x-auto">
                  <code>{`// Square thumbnails
<MediaGallery
  items={items}
  aspectRatio="square"
  gridCols={{ sm: 2, md: 4, lg: 6 }}
/>

// 16:9 video aspect ratio
<MediaGallery
  items={items}
  aspectRatio="video"
  gridCols={{ sm: 1, md: 2 }}
/>

// Portrait (3:4) layout
<MediaGallery
  items={items}
  aspectRatio="portrait"
  gridCols={{ sm: 2, md: 3 }}
/>`}</code>
                </pre>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Integration Guide */}
        <div className="mt-12 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg shadow-sm p-8">
          <h2 className="text-3xl font-bold mb-6">Integration Guide</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-4">Quick Start</h3>
              <ol className="space-y-3 text-sm">
                <li>
                  <strong>1. Import components:</strong>
                  <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                    <code>{`import { MediaViewer, MediaGallery } from '@/components/common';
import { useMediaViewer } from '@/hooks/useMediaViewer';`}</code>
                  </pre>
                </li>
                <li>
                  <strong>2. Prepare your media data:</strong>
                  <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                    <code>{`const items: MediaItem[] = [
  {
    id: '1',
    type: 'image',
    url: '/path/to/image.jpg',
    title: 'My Image',
  },
];`}</code>
                  </pre>
                </li>
                <li>
                  <strong>3. Use the gallery:</strong>
                  <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                    <code>{`<MediaGallery items={items} />`}</code>
                  </pre>
                </li>
              </ol>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-4">Advanced Usage</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <strong>Custom callbacks:</strong>
                  <p className="text-gray-600 mt-1">
                    Handle download, share, and item change events
                  </p>
                </li>
                <li>
                  <strong>Flexible options:</strong>
                  <p className="text-gray-600 mt-1">
                    Configure zoom limits, keyboard shortcuts, and touch behavior
                  </p>
                </li>
                <li>
                  <strong>Responsive design:</strong>
                  <p className="text-gray-600 mt-1">
                    Automatically adapts to different screen sizes
                  </p>
                </li>
                <li>
                  <strong>Accessibility:</strong>
                  <p className="text-gray-600 mt-1">
                    Full keyboard navigation and screen reader support
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaViewerExamples;
