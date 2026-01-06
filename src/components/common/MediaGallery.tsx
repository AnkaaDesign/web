import React from 'react';
import { MediaViewer, MediaItem } from './MediaViewer';
import { useMediaViewer } from '@/hooks/useMediaViewer';
import { ImageIcon, Video, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaGalleryProps {
  items: MediaItem[];
  className?: string;
  gridCols?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  showTitles?: boolean;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
}

/**
 * Reusable media gallery component with integrated viewer
 */
export const MediaGallery: React.FC<MediaGalleryProps> = ({
  items,
  className,
  gridCols = { sm: 2, md: 3, lg: 4, xl: 4 },
  showTitles = true,
  aspectRatio = 'square',
}) => {
  const { isOpen, currentIndex, openViewer, closeViewer } = useMediaViewer(items);

  const getGridClass = () => {
    const classes = ['grid', 'grid-cols-1'];

    if (gridCols.sm) classes.push(`sm:grid-cols-${gridCols.sm}`);
    if (gridCols.md) classes.push(`md:grid-cols-${gridCols.md}`);
    if (gridCols.lg) classes.push(`lg:grid-cols-${gridCols.lg}`);
    if (gridCols.xl) classes.push(`xl:grid-cols-${gridCols.xl}`);

    return classes.join(' ');
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'square':
        return 'aspect-square';
      case 'video':
        return 'aspect-video';
      case 'portrait':
        return 'aspect-[3/4]';
      case 'auto':
        return '';
      default:
        return 'aspect-square';
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">No media items to display</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn(getGridClass(), 'gap-4', className)}>
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => openViewer(index)}
            className={cn(
              'group relative rounded-lg overflow-hidden shadow-sm',
              'hover:shadow-sm hover:scale-[1.02] transition-all duration-300',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              getAspectRatioClass()
            )}
          >
            {item.type === 'image' ? (
              <>
                <img
                  src={item.thumbnail || item.url}
                  alt={item.alt || item.title || `Media item ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {showTitles && item.title && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="flex items-center gap-2 text-white">
                        <ImageIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{item.title}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="relative w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative z-10">
                  <Play className="w-12 h-12 text-white/80 group-hover:text-white group-hover:scale-110 transition-all duration-300" />
                </div>
                {showTitles && item.title && (
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center gap-2 text-white">
                      <Video className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{item.title}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </button>
        ))}
      </div>

      <MediaViewer
        items={items}
        initialIndex={currentIndex}
        isOpen={isOpen}
        onClose={closeViewer}
      />
    </>
  );
};
