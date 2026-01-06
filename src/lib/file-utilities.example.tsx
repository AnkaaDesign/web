/**
 * File Utilities - React Component Examples
 *
 * This file demonstrates practical usage of the file utilities
 * in React components.
 */

import React, { useState, useCallback } from 'react';
import { fileUtilities, type FileMetadata, type ValidationResult } from './file-utilities';

// =====================================================
// Example 1: File Upload Component with Validation
// =====================================================

interface FileUploadProps {
  onUpload: (file: File, metadata: FileMetadata) => Promise<void>;
  maxSizeMB?: number;
  allowedTypes?: string[];
  allowedCategories?: string[];
}

export function FileUploadWithValidation({
  onUpload,
  maxSizeMB = 10,
  allowedTypes,
  allowedCategories
}: FileUploadProps) {
  const [error, setError] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError([]);

    // Validate file
    const validation = fileUtilities.validateFile(file, {
      maxSizeInMB,
      allowedExtensions: allowedTypes,
      allowedCategories: allowedCategories as any,
      useBrazilianFormat: true
    });

    if (!validation.valid) {
      setError(validation.errors);
      return;
    }

    // Get metadata
    const metadata = fileUtilities.getFileMetadata(file);

    setUploading(true);
    try {
      await onUpload(file, metadata);
    } catch (err) {
      setError([err instanceof Error ? err.message : 'Erro ao fazer upload']);
    } finally {
      setUploading(false);
    }
  }, [onUpload, maxSizeMB, allowedTypes, allowedCategories]);

  return (
    <div className="space-y-4">
      <input
        type="file"
        onChange={handleFileChange}
        disabled={uploading}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-md file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100"
      />

      {error.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h4 className="text-red-800 font-semibold mb-2">Erros de validação:</h4>
          <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
            {error.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {uploading && (
        <div className="text-blue-600">Enviando arquivo...</div>
      )}
    </div>
  );
}

// =====================================================
// Example 2: File Gallery with Thumbnails
// =====================================================

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
}

interface FileGalleryProps {
  files: FileItem[];
  onDelete?: (fileId: string) => void;
  onDownload?: (fileId: string, filename: string) => void;
}

export function FileGallery({ files, onDelete, onDownload }: FileGalleryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {files.map(file => {
        const thumbnail = fileUtilities.getThumbnailUrlOrFallback(
          file.id,
          file.name,
          file.type,
          { size: 'md', quality: 85 }
        );

        const category = fileUtilities.getFileCategory(file.name, file.type);
        const formattedSize = fileUtilities.formatFileSizeBrazilian(file.size);
        const truncatedName = fileUtilities.truncateFilename(file.name, 30);

        return (
          <div
            key={file.id}
            className="border rounded-lg overflow-hidden hover:shadow-sm transition-shadow"
          >
            {/* Thumbnail or Icon */}
            <div className="aspect-square bg-gray-100 flex items-center justify-center p-4">
              {thumbnail.type === 'url' ? (
                <img
                  src={thumbnail.value}
                  alt={file.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-gray-400 text-6xl">
                  {/* Replace with actual icon component */}
                  📄
                </div>
              )}
            </div>

            {/* File Info */}
            <div className="p-3 space-y-2">
              <h3 className="text-sm font-medium truncate" title={file.name}>
                {truncatedName}
              </h3>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="capitalize">{category}</span>
                <span>{formattedSize}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {onDownload && (
                  <button
                    onClick={() => onDownload(file.id, file.name)}
                    className="flex-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Baixar
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(file.id)}
                    className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// Example 3: File Preview Modal
// =====================================================

interface FilePreviewModalProps {
  fileId: string;
  filename: string;
  mimeType?: string;
  onClose: () => void;
}

export function FilePreviewModal({ fileId, filename, mimeType, onClose }: FilePreviewModalProps) {
  const preview = fileUtilities.getPreviewUrlWithFallback(fileId, filename, mimeType);

  if (!preview.canPreview) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-4 max-w-md">
          <h3 className="text-lg font-semibold mb-4">Visualização não disponível</h3>
          <p className="text-gray-600 mb-4">
            Este tipo de arquivo não pode ser visualizado no navegador.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const renderPreview = () => {
    switch (preview.previewType) {
      case 'image':
        return (
          <img
            src={preview.previewUrl}
            alt={filename}
            className="max-w-full max-h-[80vh] object-contain"
          />
        );

      case 'video':
        return (
          <video
            src={preview.previewUrl}
            controls
            className="max-w-full max-h-[80vh]"
          />
        );

      case 'audio':
        return (
          <div className="p-8">
            <div className="text-6xl text-center mb-4">🎵</div>
            <audio src={preview.previewUrl} controls className="w-full" />
            <p className="text-center mt-4 text-gray-600">{filename}</p>
          </div>
        );

      case 'pdf':
        return (
          <iframe
            src={preview.previewUrl}
            className="w-full h-[80vh]"
            title={filename}
          />
        );

      case 'code':
      case 'text':
        return (
          <iframe
            src={preview.previewUrl}
            className="w-full h-[80vh] bg-gray-50"
            title={filename}
          />
        );

      default:
        return <div>Tipo de visualização desconhecido</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold truncate">{filename}</h3>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Fechar
          </button>
        </div>

        {/* Preview */}
        <div className="p-4 flex items-center justify-center">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Example 4: File List with Metadata
// =====================================================

interface FileListProps {
  files: FileItem[];
  onSelect?: (fileId: string) => void;
  selectedFileId?: string;
}

export function FileListWithMetadata({ files, onSelect, selectedFileId }: FileListProps) {
  return (
    <div className="divide-y border rounded-lg">
      {files.map(file => {
        const extension = fileUtilities.getFileExtension(file.name);
        const category = fileUtilities.getFileCategory(file.name, file.type);
        const formattedSize = fileUtilities.formatFileSizeBrazilian(file.size);
        const icon = fileUtilities.getFallbackIcon(file.name, file.type);
        const canPreview = fileUtilities.canPreview(file.name, file.type);

        const isSelected = selectedFileId === file.id;

        return (
          <div
            key={file.id}
            className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors ${
              isSelected ? 'bg-blue-50' : ''
            }`}
            onClick={() => onSelect?.(file.id)}
          >
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-2xl">
                {/* Replace with actual icon component */}
                📄
              </div>
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium truncate">{file.name}</h4>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span className="uppercase">{extension || 'unknown'}</span>
                <span>•</span>
                <span className="capitalize">{category}</span>
                <span>•</span>
                <span>{formattedSize}</span>
                {canPreview && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600">Visualizável</span>
                  </>
                )}
              </div>
            </div>

            {/* Date */}
            <div className="text-xs text-gray-500">
              {new Date(file.createdAt).toLocaleDateString('pt-BR')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// Example 5: Drag & Drop Upload with Progress
// =====================================================

interface DragDropUploadProps {
  onUpload: (file: File) => Promise<void>;
  maxSizeMB?: number;
  allowedCategories?: string[];
}

export function DragDropUpload({
  onUpload,
  maxSizeMB = 50,
  allowedCategories
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<Array<{ file: File; metadata: FileMetadata; progress: number }>>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrors([]);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles: Array<{ file: File; metadata: FileMetadata }> = [];
    const newErrors: string[] = [];

    for (const file of droppedFiles) {
      // Validate
      const validation = fileUtilities.validateFile(file, {
        maxSizeInMB,
        allowedCategories: allowedCategories as any,
        useBrazilianFormat: true
      });

      if (!validation.valid) {
        newErrors.push(`${file.name}: ${validation.errors.join(', ')}`);
        continue;
      }

      const metadata = fileUtilities.getFileMetadata(file);
      validFiles.push({ file, metadata });
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
    }

    // Upload valid files
    for (const { file, metadata } of validFiles) {
      setFiles(prev => [...prev, { file, metadata, progress: 0 }]);

      try {
        await onUpload(file);
        setFiles(prev =>
          prev.map(f => f.file === file ? { ...f, progress: 100 } : f)
        );
      } catch (err) {
        setErrors(prev => [...prev, `${file.name}: Erro ao enviar`]);
      }
    }
  }, [onUpload, maxSizeMB, allowedCategories]);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50'
        }`}
      >
        <div className="text-6xl mb-4">📁</div>
        <p className="text-lg font-medium text-gray-700">
          Arraste arquivos aqui
        </p>
        <p className="text-sm text-gray-500 mt-2">
          ou clique para selecionar
        </p>
        <p className="text-xs text-gray-400 mt-4">
          Tamanho máximo: {maxSizeMB} MB
          {allowedCategories && (
            <> • Tipos: {allowedCategories.join(', ')}</>
          )}
        </p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h4 className="text-red-800 font-semibold mb-2">Erros:</h4>
          <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold">Arquivos:</h4>
          {files.map((item, i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{item.metadata.name}</span>
                <span className="text-sm text-gray-500">
                  {item.metadata.formattedSizeBrazilian}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${item.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span className="capitalize">{item.metadata.category}</span>
                <span>{item.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// Example 6: File Download Manager
// =====================================================

interface DownloadManagerProps {
  files: Array<{ id: string; name: string; size: number }>;
}

export function FileDownloadManager({ files }: DownloadManagerProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (fileId: string, filename: string) => {
    setDownloading(fileId);
    setError(null);

    try {
      const url = fileUtilities.generateDownloadUrl(fileId, filename);
      await fileUtilities.downloadFile(url, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao baixar arquivo');
    } finally {
      setDownloading(null);
    }
  };

  const handleBulkDownload = async () => {
    for (const file of files) {
      await handleDownload(file.id, file.name);
      // Delay between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Downloads</h3>
        <button
          onClick={handleBulkDownload}
          disabled={downloading !== null}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Baixar Todos
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="divide-y border rounded-lg">
        {files.map(file => {
          const formattedSize = fileUtilities.formatFileSizeBrazilian(file.size);
          const isDownloading = downloading === file.id;

          return (
            <div key={file.id} className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-medium">{file.name}</h4>
                <p className="text-sm text-gray-500">{formattedSize}</p>
              </div>

              <button
                onClick={() => handleDownload(file.id, file.name)}
                disabled={isDownloading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isDownloading ? 'Baixando...' : 'Baixar'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
