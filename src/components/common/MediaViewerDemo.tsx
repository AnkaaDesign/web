import React from 'react';
import { MediaViewer, MediaItem } from './MediaViewer';
import { useMediaViewer } from '@/hooks/useMediaViewer';
import { ImageIcon, Video, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Demo component showing how to use the MediaViewer
 */
export const MediaViewerDemo: React.FC = () => {
  // Sample media items - replace with your actual data
  const mediaItems: MediaItem[] = [
    {
      id: '1',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop',
      title: 'Mountain Landscape',
      alt: 'Beautiful mountain landscape',
    },
    {
      id: '2',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&h=1080&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200&h=200&fit=crop',
      title: 'Forest Path',
      alt: 'Scenic forest path',
    },
    {
      id: '3',
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      title: 'Sample Video',
    },
    {
      id: '4',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&h=1080&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=200&h=200&fit=crop',
      title: 'Beach Sunset',
      alt: 'Beautiful beach sunset',
    },
    {
      id: '5',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&h=1080&fit=crop',
      thumbnail: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=200&h=200&fit=crop',
      title: 'Aurora Borealis',
      alt: 'Northern lights display',
    },
    {
      id: '6',
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      title: 'Another Video',
    },
  ];

  const { isOpen, currentIndex, openViewer, closeViewer } = useMediaViewer(mediaItems);

  return (
    <div className="p-8 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Media Viewer Demo</h1>
          <p className="text-gray-600">
            Click on any image or video to open the full-screen viewer
          </p>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Keyboard Shortcuts:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><kbd className="px-2 py-1 bg-white rounded border border-blue-300 text-xs">ESC</kbd> - Close viewer</li>
              <li><kbd className="px-2 py-1 bg-white rounded border border-blue-300 text-xs">←</kbd> / <kbd className="px-2 py-1 bg-white rounded border border-blue-300 text-xs">→</kbd> - Navigate between items</li>
              <li><kbd className="px-2 py-1 bg-white rounded border border-blue-300 text-xs">+</kbd> / <kbd className="px-2 py-1 bg-white rounded border border-blue-300 text-xs">-</kbd> - Zoom in/out (images)</li>
              <li><kbd className="px-2 py-1 bg-white rounded border border-blue-300 text-xs">R</kbd> - Rotate image</li>
              <li><kbd className="px-2 py-1 bg-white rounded border border-blue-300 text-xs">SPACE</kbd> - Play/pause video</li>
            </ul>
          </div>
        </div>

        {/* Media Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {mediaItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => openViewer(index)}
              className={cn(
                'group relative aspect-square rounded-xl overflow-hidden shadow-sm',
                'hover:shadow-2xl hover:scale-105 transition-all duration-300',
                'focus:outline-none focus:ring-4 focus:ring-blue-500/50'
              )}
            >
              {item.type === 'image' ? (
                <>
                  <img
                    src={item.thumbnail || item.url}
                    alt={item.alt || item.title || 'Media item'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="flex items-center gap-2 text-white">
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-sm font-medium truncate">{item.title}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="relative w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/20" />
                  <Play className="w-16 h-16 text-white/80 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center gap-2 text-white">
                      <Video className="w-4 h-4" />
                      <span className="text-sm font-medium truncate">{item.title}</span>
                    </div>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Additional demo controls */}
        <div className="mt-12 bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-2xl font-semibold mb-4">Quick Access</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => openViewer(0)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open First Item
            </button>
            <button
              onClick={() => openViewer(2)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Open First Video
            </button>
            <button
              onClick={() => openViewer(mediaItems.length - 1)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Open Last Item
            </button>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <ImageIcon className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Image Features</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Zoom in/out up to 4x</li>
              <li>• Pan zoomed images</li>
              <li>• Rotate in 90° increments</li>
              <li>• Download images</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Video className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Video Features</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Play/pause controls</li>
              <li>• Volume adjustment</li>
              <li>• Progress seeking</li>
              <li>• Fullscreen mode</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Play className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Navigation</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Keyboard shortcuts</li>
              <li>• Touch/swipe support</li>
              <li>• Thumbnail navigation</li>
              <li>• Smooth transitions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Media Viewer Component */}
      <MediaViewer
        items={mediaItems}
        initialIndex={currentIndex}
        isOpen={isOpen}
        onClose={closeViewer}
      />
    </div>
  );
};

export default MediaViewerDemo;
