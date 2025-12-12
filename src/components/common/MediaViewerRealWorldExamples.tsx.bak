import React, { useState, useCallback } from 'react';
import { MediaGallery } from './MediaGallery';
import { MediaViewerEnhanced } from './MediaViewerEnhanced';
import { useMediaViewer } from '@/hooks/useMediaViewer';
import { MediaItem } from '@/types/media';
import { filesToMediaItems, sortMediaItems, filterMediaByType } from '@/utils/mediaHelpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

/**
 * Real-world examples and use cases for the Media Viewer
 */

// Example 1: File Upload with Preview
export const FileUploadWithPreview: React.FC = () => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const viewer = useMediaViewer(mediaItems);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const items = await filesToMediaItems(files);
      setMediaItems((prev) => [...prev, ...items]);
      toast.success(`${files.length} file(s) added`);
    } catch (error) {
      toast.error('Failed to process files');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = (id: string) => {
    setMediaItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <Button disabled={isUploading}>
          {isUploading ? 'Processing...' : 'Upload Files'}
        </Button>
      </div>

      {mediaItems.length > 0 && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              {mediaItems.length} file(s) selected
            </span>
            <Button variant="outline" onClick={() => setMediaItems([])}>
              Clear All
            </Button>
          </div>

          <MediaGallery
            items={mediaItems}
            gridCols={{ sm: 2, md: 4, lg: 6 }}
          />
        </>
      )}
    </div>
  );
};

// Example 2: Product Photo Gallery
interface Product {
  id: string;
  name: string;
  images: Array<{
    id: string;
    url: string;
    thumbnail?: string;
    title?: string;
  }>;
}

export const ProductPhotoGallery: React.FC<{ product: Product }> = ({ product }) => {
  const mediaItems: MediaItem[] = product.images.map((img) => ({
    id: img.id,
    type: 'image' as const,
    url: img.url,
    thumbnail: img.thumbnail,
    title: img.title || `${product.name} - Photo`,
    alt: `${product.name} product image`,
  }));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{product.name}</h2>
      <MediaGallery
        items={mediaItems}
        gridCols={{ sm: 2, md: 3, lg: 4 }}
        aspectRatio="square"
        showTitles={false}
      />
    </div>
  );
};

// Example 3: Social Media Feed
interface Post {
  id: string;
  author: string;
  content: string;
  media: MediaItem[];
  timestamp: Date;
}

export const SocialMediaFeed: React.FC<{ posts: Post[] }> = ({ posts }) => {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const viewer = useMediaViewer(selectedPost?.media || []);

  const openPost = (post: Post, mediaIndex: number = 0) => {
    setSelectedPost(post);
    viewer.openViewer(mediaIndex);
  };

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <div key={post.id} className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gray-200" />
            <div>
              <p className="font-semibold">{post.author}</p>
              <p className="text-sm text-gray-500">
                {post.timestamp.toLocaleDateString()}
              </p>
            </div>
          </div>

          <p className="mb-3">{post.content}</p>

          {post.media.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {post.media.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => openPost(post, index)}
                  className="aspect-square rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                >
                  <img
                    src={item.thumbnail || item.url}
                    alt={item.alt || 'Post media'}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {selectedPost && (
        <MediaViewerEnhanced
          items={selectedPost.media}
          initialIndex={viewer.currentIndex}
          isOpen={viewer.isOpen}
          onClose={viewer.closeViewer}
          options={{
            showThumbnails: true,
            enableDownload: true,
            loop: true,
          }}
        />
      )}
    </div>
  );
};

// Example 4: Documentation with Screenshots
interface Documentation {
  id: string;
  title: string;
  content: string;
  screenshots: MediaItem[];
}

export const DocumentationViewer: React.FC<{ docs: Documentation[] }> = ({ docs }) => {
  const [activeDoc, setActiveDoc] = useState(0);
  const viewer = useMediaViewer(docs[activeDoc]?.screenshots || []);

  return (
    <div className="grid md:grid-cols-[300px,1fr] gap-6">
      {/* Sidebar */}
      <div className="space-y-2">
        {docs.map((doc, index) => (
          <button
            key={doc.id}
            onClick={() => setActiveDoc(index)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              activeDoc === index
                ? 'bg-blue-100 text-blue-900'
                : 'hover:bg-gray-100'
            }`}
          >
            {doc.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{docs[activeDoc].title}</h1>
        <div className="prose max-w-none">{docs[activeDoc].content}</div>

        {docs[activeDoc].screenshots.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Screenshots</h2>
            <MediaGallery
              items={docs[activeDoc].screenshots}
              gridCols={{ sm: 1, md: 2 }}
              aspectRatio="video"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Example 5: Video Tutorial Library
interface Tutorial {
  id: string;
  title: string;
  description: string;
  video: MediaItem;
  thumbnail: string;
  duration: number;
}

export const VideoTutorialLibrary: React.FC<{ tutorials: Tutorial[] }> = ({
  tutorials,
}) => {
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'title' | 'date'>('date');

  const mediaItems = tutorials.map((t) => t.video);
  const viewer = useMediaViewer(mediaItems);

  const filteredTutorials = tutorials; // Add your filtering logic

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Videos</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'title' | 'date')}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="date">Sort by Date</option>
          <option value="title">Sort by Title</option>
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTutorials.map((tutorial, index) => (
          <div
            key={tutorial.id}
            className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow"
          >
            <button
              onClick={() => viewer.openViewer(index)}
              className="relative w-full aspect-video group"
            >
              <img
                src={tutorial.thumbnail}
                alt={tutorial.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[20px] border-l-black border-y-[12px] border-y-transparent ml-1" />
                </div>
              </div>
              <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                {Math.floor(tutorial.duration / 60)}:
                {(tutorial.duration % 60).toString().padStart(2, '0')}
              </span>
            </button>
            <div className="p-4">
              <h3 className="font-semibold mb-2">{tutorial.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2">
                {tutorial.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <MediaViewerEnhanced
        items={mediaItems}
        initialIndex={viewer.currentIndex}
        isOpen={viewer.isOpen}
        onClose={viewer.closeViewer}
        options={{
          autoPlay: true,
          showThumbnails: true,
          loop: false,
        }}
      />
    </div>
  );
};

// Example 6: Image Comparison Tool
export const ImageComparisonTool: React.FC = () => {
  const [beforeImage, setBeforeImage] = useState<MediaItem | null>(null);
  const [afterImage, setAfterImage] = useState<MediaItem | null>(null);

  const mediaItems = [beforeImage, afterImage].filter(Boolean) as MediaItem[];
  const viewer = useMediaViewer(mediaItems);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'before' | 'after'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const items = await filesToMediaItems([file]);
    const item = { ...items[0], title: `${type} image` };

    if (type === 'before') {
      setBeforeImage(item);
    } else {
      setAfterImage(item);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Before & After Comparison</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Before</label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(e, 'before')}
          />
          {beforeImage && (
            <button
              onClick={() => viewer.openViewer(0)}
              className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition-colors"
            >
              <img
                src={beforeImage.url}
                alt="Before"
                className="w-full h-full object-cover"
              />
            </button>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">After</label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(e, 'after')}
          />
          {afterImage && (
            <button
              onClick={() => viewer.openViewer(1)}
              className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition-colors"
            >
              <img
                src={afterImage.url}
                alt="After"
                className="w-full h-full object-cover"
              />
            </button>
          )}
        </div>
      </div>

      {mediaItems.length > 0 && (
        <MediaViewerEnhanced
          items={mediaItems}
          initialIndex={viewer.currentIndex}
          isOpen={viewer.isOpen}
          onClose={viewer.closeViewer}
          options={{
            enableZoom: true,
            enableRotation: true,
            showThumbnails: mediaItems.length > 1,
          }}
        />
      )}
    </div>
  );
};

// Example 7: Portfolio with Filtering
export const PortfolioGallery: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sample portfolio items
  const allItems: MediaItem[] = [
    // Add your portfolio items here
  ];

  const filteredItems = filter === 'all'
    ? allItems
    : filterMediaByType(allItems, filter);

  const sortedItems = sortMediaItems(filteredItems, 'date', sortOrder);

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'image' ? 'default' : 'outline'}
            onClick={() => setFilter('image')}
          >
            Images
          </Button>
          <Button
            variant={filter === 'video' ? 'default' : 'outline'}
            onClick={() => setFilter('video')}
          >
            Videos
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
        </Button>
      </div>

      <MediaGallery
        items={sortedItems}
        gridCols={{ sm: 2, md: 3, lg: 4 }}
        aspectRatio="square"
      />
    </div>
  );
};

// Example 8: Event Photo Album
interface Event {
  id: string;
  name: string;
  date: Date;
  location: string;
  photos: MediaItem[];
}

export const EventPhotoAlbum: React.FC<{ events: Event[] }> = ({ events }) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const viewer = useMediaViewer(selectedEvent?.photos || []);

  const handleDownload = useCallback(async (item: MediaItem) => {
    toast.success(`Downloading ${item.title || 'image'}...`);
    // Implement download logic
  }, []);

  const handleShare = useCallback((item: MediaItem) => {
    if (navigator.share) {
      navigator.share({
        title: item.title,
        text: `Check out this photo from ${selectedEvent?.name}`,
        url: item.url,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(item.url);
      toast.success('Link copied to clipboard!');
    }
  }, [selectedEvent]);

  return (
    <div className="space-y-8">
      {events.map((event) => (
        <div key={event.id} className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{event.name}</h2>
              <p className="text-gray-600">
                {event.date.toLocaleDateString()} • {event.location}
              </p>
            </div>
            <span className="text-sm text-gray-500">
              {event.photos.length} photos
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {event.photos.slice(0, 12).map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => {
                  setSelectedEvent(event);
                  viewer.openViewer(index);
                }}
                className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
              >
                <img
                  src={photo.thumbnail || photo.url}
                  alt={photo.title || `Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>

          {event.photos.length > 12 && (
            <Button
              variant="outline"
              onClick={() => {
                setSelectedEvent(event);
                viewer.openViewer(0);
              }}
            >
              View All {event.photos.length} Photos
            </Button>
          )}
        </div>
      ))}

      {selectedEvent && (
        <MediaViewerEnhanced
          items={selectedEvent.photos}
          initialIndex={viewer.currentIndex}
          isOpen={viewer.isOpen}
          onClose={() => {
            viewer.closeViewer();
            setSelectedEvent(null);
          }}
          options={{
            showThumbnails: true,
            enableDownload: true,
            loop: true,
          }}
          onDownload={handleDownload}
          onShare={handleShare}
          onItemChange={(index, item) => {
            console.log(`Viewing photo ${index + 1} of ${selectedEvent.photos.length}`);
          }}
        />
      )}
    </div>
  );
};

export default {
  FileUploadWithPreview,
  ProductPhotoGallery,
  SocialMediaFeed,
  DocumentationViewer,
  VideoTutorialLibrary,
  ImageComparisonTool,
  PortfolioGallery,
  EventPhotoAlbum,
};
