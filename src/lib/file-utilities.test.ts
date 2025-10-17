/**
 * File Utilities - Test Suite
 *
 * Comprehensive tests for all file utility functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFileExtension,
  getFileNameWithoutExtension,
  getMimeTypeFromExtension,
  getMimeTypeFromFilename,
  getFileCategory,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isDocumentFile,
  formatFileSize,
  formatFileSizeBrazilian,
  formatFileSizeCompact,
  truncateFilename,
  validateFileSize,
  validateFileType,
  checkFilenameSecurity,
  sanitizeFilename,
  canPreview,
  getPreviewType,
  generateUniqueFilename,
  generateImageThumbnailUrl,
  generateDownloadUrl,
  getFallbackIcon,
} from './file-utilities';

describe('File Type Detection', () => {
  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('photo.jpg')).toBe('jpg');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('README')).toBe('');
      expect(getFileExtension('makefile')).toBe('');
    });

    it('should handle hidden files', () => {
      expect(getFileExtension('.gitignore')).toBe('gitignore');
      expect(getFileExtension('.env.local')).toBe('local');
    });

    it('should be case-insensitive', () => {
      expect(getFileExtension('Document.PDF')).toBe('pdf');
      expect(getFileExtension('PHOTO.JPG')).toBe('jpg');
    });
  });

  describe('getFileNameWithoutExtension', () => {
    it('should remove extension from filename', () => {
      expect(getFileNameWithoutExtension('document.pdf')).toBe('document');
      expect(getFileNameWithoutExtension('my.file.txt')).toBe('my.file');
    });

    it('should return full name if no extension', () => {
      expect(getFileNameWithoutExtension('README')).toBe('README');
    });
  });

  describe('getMimeTypeFromExtension', () => {
    it('should return correct MIME type for common extensions', () => {
      expect(getMimeTypeFromExtension('pdf')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromExtension('mp4')).toBe('video/mp4');
      expect(getMimeTypeFromExtension('json')).toBe('application/json');
    });

    it('should return default MIME type for unknown extensions', () => {
      expect(getMimeTypeFromExtension('xyz')).toBe('application/octet-stream');
    });

    it('should be case-insensitive', () => {
      expect(getMimeTypeFromExtension('PDF')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('JPG')).toBe('image/jpeg');
    });
  });

  describe('getMimeTypeFromFilename', () => {
    it('should extract MIME type from filename', () => {
      expect(getMimeTypeFromFilename('document.pdf')).toBe('application/pdf');
      expect(getMimeTypeFromFilename('photo.png')).toBe('image/png');
    });
  });

  describe('getFileCategory', () => {
    it('should categorize image files', () => {
      expect(getFileCategory('photo.jpg')).toBe('image');
      expect(getFileCategory('logo.png')).toBe('image');
      expect(getFileCategory('icon.svg')).toBe('image');
    });

    it('should categorize video files', () => {
      expect(getFileCategory('movie.mp4')).toBe('video');
      expect(getFileCategory('clip.webm')).toBe('video');
    });

    it('should categorize audio files', () => {
      expect(getFileCategory('song.mp3')).toBe('audio');
      expect(getFileCategory('podcast.wav')).toBe('audio');
    });

    it('should categorize document files', () => {
      expect(getFileCategory('report.pdf')).toBe('document');
      expect(getFileCategory('letter.docx')).toBe('document');
      expect(getFileCategory('data.xlsx')).toBe('document');
    });

    it('should categorize archive files', () => {
      expect(getFileCategory('backup.zip')).toBe('archive');
      expect(getFileCategory('files.tar.gz')).toBe('archive');
    });

    it('should categorize code files', () => {
      expect(getFileCategory('script.js')).toBe('code');
      expect(getFileCategory('component.tsx')).toBe('code');
      expect(getFileCategory('config.json')).toBe('code');
    });

    it('should use MIME type as fallback', () => {
      expect(getFileCategory('unknown', 'image/jpeg')).toBe('image');
      expect(getFileCategory('test', 'application/pdf')).toBe('document');
    });

    it('should return "other" for unknown types', () => {
      expect(getFileCategory('file.xyz')).toBe('other');
    });
  });

  describe('Type Checkers', () => {
    it('should identify image files', () => {
      expect(isImageFile('photo.jpg')).toBe(true);
      expect(isImageFile('document.pdf')).toBe(false);
    });

    it('should identify video files', () => {
      expect(isVideoFile('movie.mp4')).toBe(true);
      expect(isVideoFile('photo.jpg')).toBe(false);
    });

    it('should identify audio files', () => {
      expect(isAudioFile('song.mp3')).toBe(true);
      expect(isAudioFile('video.mp4')).toBe(false);
    });

    it('should identify document files', () => {
      expect(isDocumentFile('report.pdf')).toBe(true);
      expect(isDocumentFile('photo.jpg')).toBe(false);
    });
  });
});

describe('File Size Formatting', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1048576)).toBe('1.00 MB');
      expect(formatFileSize(1073741824)).toBe('1.00 GB');
    });

    it('should handle decimal values', () => {
      expect(formatFileSize(1536)).toBe('1.50 KB');
      expect(formatFileSize(1572864)).toBe('1.50 MB');
    });
  });

  describe('formatFileSizeBrazilian', () => {
    it('should format with Brazilian number format', () => {
      expect(formatFileSizeBrazilian(0)).toBe('0 Bytes');
      expect(formatFileSizeBrazilian(1024)).toBe('1,00 KB');
      expect(formatFileSizeBrazilian(1048576)).toBe('1,00 MB');
    });

    it('should use comma as decimal separator', () => {
      expect(formatFileSizeBrazilian(1536)).toBe('1,50 KB');
      expect(formatFileSizeBrazilian(1572864)).toBe('1,50 MB');
    });
  });

  describe('formatFileSizeCompact', () => {
    it('should format compactly', () => {
      expect(formatFileSizeCompact(0)).toBe('0B');
      expect(formatFileSizeCompact(1024)).toBe('1.0KB');
      expect(formatFileSizeCompact(1048576)).toBe('1.0MB');
    });
  });
});

describe('Filename Utilities', () => {
  describe('truncateFilename', () => {
    it('should not truncate short filenames', () => {
      expect(truncateFilename('file.pdf', 20)).toBe('file.pdf');
    });

    it('should truncate long filenames', () => {
      const result = truncateFilename('very-long-document-name.pdf', 20);
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toContain('...');
      expect(result).toContain('.pdf');
    });

    it('should preserve extension when truncating', () => {
      const result = truncateFilename('extremely-long-filename-here.docx', 25);
      expect(result).toMatch(/\.docx$/);
    });

    it('should handle files without extension', () => {
      const result = truncateFilename('verylongfilenamewithoutextension', 20);
      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeFilename('file<>:|?.txt')).toBe('file_____.txt');
    });

    it('should replace spaces with underscores by default', () => {
      expect(sanitizeFilename('my document.pdf')).toBe('my_document.pdf');
    });

    it('should preserve spaces when configured', () => {
      expect(sanitizeFilename('my document.pdf', { removeSpaces: false }))
        .toBe('my document.pdf');
    });

    it('should convert to lowercase by default', () => {
      expect(sanitizeFilename('MyFile.PDF')).toBe('myfile.pdf');
    });

    it('should preserve case when configured', () => {
      expect(sanitizeFilename('MyFile.PDF', { preserveCase: true }))
        .toBe('MyFile.PDF');
    });

    it('should truncate to max length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName, { maxLength: 255 });
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result).toMatch(/\.txt$/);
    });

    it('should remove multiple consecutive separators', () => {
      expect(sanitizeFilename('file___name.pdf')).toBe('file_name.pdf');
      expect(sanitizeFilename('file...name.pdf')).toBe('file.name.pdf');
    });

    it('should handle Unicode characters when allowed', () => {
      expect(sanitizeFilename('arquivo-português.pdf', { allowUnicode: true }))
        .toBe('arquivo-português.pdf');
    });

    it('should remove Unicode when not allowed', () => {
      const result = sanitizeFilename('arquivo-português.pdf', { allowUnicode: false });
      expect(result).not.toContain('ã');
      expect(result).not.toContain('ê');
    });

    it('should return default name if everything removed', () => {
      expect(sanitizeFilename('!!!')).toBe('arquivo');
    });
  });

  describe('generateUniqueFilename', () => {
    it('should return original name if unique', () => {
      expect(generateUniqueFilename('file.pdf', [])).toBe('file.pdf');
    });

    it('should append number if name exists', () => {
      const existing = ['file.pdf'];
      expect(generateUniqueFilename('file.pdf', existing)).toBe('file_1.pdf');
    });

    it('should increment number for multiple duplicates', () => {
      const existing = ['file.pdf', 'file_1.pdf', 'file_2.pdf'];
      expect(generateUniqueFilename('file.pdf', existing)).toBe('file_3.pdf');
    });

    it('should preserve extension', () => {
      const existing = ['document.docx'];
      const result = generateUniqueFilename('document.docx', existing);
      expect(result).toMatch(/\.docx$/);
    });

    it('should use custom separator', () => {
      const existing = ['file.pdf'];
      const result = generateUniqueFilename('file.pdf', existing, { separator: '-' });
      expect(result).toBe('file-1.pdf');
    });

    it('should truncate if exceeds max length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = generateUniqueFilename(longName, [longName], { maxLength: 255 });
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });
});

describe('Validation', () => {
  describe('validateFileSize', () => {
    it('should validate within limits', () => {
      const result = validateFileSize(5 * 1024 * 1024, { maxSizeInMB: 10 });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject files exceeding max size', () => {
      const result = validateFileSize(15 * 1024 * 1024, { maxSizeInMB: 10 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('muito grande');
    });

    it('should reject files below min size', () => {
      const result = validateFileSize(0, { minSizeInBytes: 1 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('muito pequeno');
    });

    it('should use Brazilian format in error messages', () => {
      const result = validateFileSize(15 * 1024 * 1024, {
        maxSizeInMB: 10,
        useBrazilianFormat: true
      });
      expect(result.error).toContain(',');
    });
  });

  describe('validateFileType', () => {
    it('should validate allowed extensions', () => {
      const result = validateFileType('file.pdf', 'application/pdf', {
        extensions: ['pdf', 'doc', 'docx']
      });
      expect(result.valid).toBe(true);
    });

    it('should reject disallowed extensions', () => {
      const result = validateFileType('file.exe', 'application/x-msdownload', {
        extensions: ['pdf', 'doc']
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('não permitido');
    });

    it('should validate allowed MIME types', () => {
      const result = validateFileType('file.pdf', 'application/pdf', {
        mimeTypes: ['application/pdf', 'image/jpeg']
      });
      expect(result.valid).toBe(true);
    });

    it('should validate allowed categories', () => {
      const result = validateFileType('file.pdf', 'application/pdf', {
        categories: ['document' as any]
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('checkFilenameSecurity', () => {
    it('should pass safe filenames', () => {
      const result = checkFilenameSecurity('document.pdf');
      expect(result.safe).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect path traversal', () => {
      const result = checkFilenameSecurity('../../../etc/passwd');
      expect(result.safe).toBe(false);
      expect(result.issues).toContain(expect.stringContaining('navegação de diretório'));
    });

    it('should detect dangerous extensions', () => {
      const result = checkFilenameSecurity('malware.exe');
      expect(result.safe).toBe(false);
      expect(result.issues).toContain(expect.stringContaining('perigosa'));
    });

    it('should detect null bytes', () => {
      const result = checkFilenameSecurity('file\0.pdf');
      expect(result.safe).toBe(false);
      expect(result.issues).toContain(expect.stringContaining('bytes nulos'));
    });

    it('should detect control characters', () => {
      const result = checkFilenameSecurity('file\x01.pdf');
      expect(result.safe).toBe(false);
      expect(result.issues).toContain(expect.stringContaining('caracteres de controle'));
    });

    it('should detect overly long filenames', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = checkFilenameSecurity(longName);
      expect(result.safe).toBe(false);
      expect(result.issues).toContain(expect.stringContaining('muito longo'));
    });
  });
});

describe('Preview Utilities', () => {
  describe('canPreview', () => {
    it('should allow preview for images', () => {
      expect(canPreview('photo.jpg')).toBe(true);
      expect(canPreview('image.png')).toBe(true);
    });

    it('should allow preview for videos', () => {
      expect(canPreview('movie.mp4')).toBe(true);
      expect(canPreview('clip.webm')).toBe(true);
    });

    it('should allow preview for PDFs', () => {
      expect(canPreview('document.pdf')).toBe(true);
    });

    it('should allow preview for code files', () => {
      expect(canPreview('script.js')).toBe(true);
      expect(canPreview('component.tsx')).toBe(true);
    });

    it('should not allow preview for executables', () => {
      expect(canPreview('program.exe')).toBe(false);
    });

    it('should not allow preview for archives', () => {
      expect(canPreview('files.zip')).toBe(false);
    });
  });

  describe('getPreviewType', () => {
    it('should return correct preview type', () => {
      expect(getPreviewType('photo.jpg')).toBe('image');
      expect(getPreviewType('video.mp4')).toBe('video');
      expect(getPreviewType('song.mp3')).toBe('audio');
      expect(getPreviewType('document.pdf')).toBe('pdf');
      expect(getPreviewType('readme.txt')).toBe('text');
      expect(getPreviewType('script.js')).toBe('code');
      expect(getPreviewType('archive.zip')).toBe('none');
    });
  });
});

describe('URL Generation', () => {
  describe('generateImageThumbnailUrl', () => {
    it('should generate thumbnail URL with default options', () => {
      const url = generateImageThumbnailUrl('file-123');
      expect(url).toContain('/api/files/file-123/thumbnail');
      expect(url).toContain('width=256');
      expect(url).toContain('height=256');
    });

    it('should use custom size', () => {
      const url = generateImageThumbnailUrl('file-123', { size: 'lg' });
      expect(url).toContain('width=512');
      expect(url).toContain('height=512');
    });

    it('should use custom quality', () => {
      const url = generateImageThumbnailUrl('file-123', { quality: 90 });
      expect(url).toContain('quality=90');
    });

    it('should use custom format', () => {
      const url = generateImageThumbnailUrl('file-123', { format: 'webp' });
      expect(url).toContain('format=webp');
    });
  });

  describe('generateDownloadUrl', () => {
    it('should generate download URL without filename', () => {
      const url = generateDownloadUrl('file-123');
      expect(url).toBe('/api/files/file-123/download');
    });

    it('should generate download URL with filename', () => {
      const url = generateDownloadUrl('file-123', 'document.pdf');
      expect(url).toContain('/api/files/file-123/download');
      expect(url).toContain('filename=document.pdf');
    });

    it('should URL encode filename', () => {
      const url = generateDownloadUrl('file-123', 'my document.pdf');
      expect(url).toContain('filename=my%20document.pdf');
    });
  });

  describe('getFallbackIcon', () => {
    it('should return specific icon for known types', () => {
      expect(getFallbackIcon('document.pdf')).toBe('IconFileTypePdf');
      expect(getFallbackIcon('script.js')).toBe('IconBrandJavascript');
    });

    it('should return category icon for general types', () => {
      expect(getFallbackIcon('photo.jpg')).toBe('IconPhoto');
      expect(getFallbackIcon('video.mp4')).toBe('IconVideo');
    });

    it('should return default icon for unknown types', () => {
      expect(getFallbackIcon('unknown.xyz')).toBe('IconFile');
    });
  });
});

describe('Edge Cases', () => {
  it('should handle empty strings', () => {
    expect(getFileExtension('')).toBe('');
    expect(getFileCategory('')).toBe('other');
  });

  it('should handle filenames with multiple dots', () => {
    expect(getFileExtension('my.file.name.pdf')).toBe('pdf');
    expect(getFileNameWithoutExtension('my.file.name.pdf')).toBe('my.file.name');
  });

  it('should handle special characters in filenames', () => {
    const sanitized = sanitizeFilename('file (1) [copy].pdf');
    expect(sanitized).toBeTruthy();
    expect(sanitized).not.toContain('(');
    expect(sanitized).not.toContain(')');
  });

  it('should handle very large file sizes', () => {
    const size = 5 * 1024 * 1024 * 1024 * 1024; // 5 TB
    const formatted = formatFileSize(size);
    expect(formatted).toContain('TB');
  });

  it('should handle zero-byte files', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSizeBrazilian(0)).toBe('0 Bytes');
  });
});
