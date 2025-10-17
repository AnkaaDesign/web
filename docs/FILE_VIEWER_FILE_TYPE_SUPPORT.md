# File Type Support Matrix

Comprehensive reference for supported file types and their capabilities in the File Viewer system.

## Table of Contents
- [Quick Reference](#quick-reference)
- [Image Files](#image-files)
- [Video Files](#video-files)
- [PDF Files](#pdf-files)
- [Document Files](#document-files)
- [Spreadsheet Files](#spreadsheet-files)
- [Presentation Files](#presentation-files)
- [Audio Files](#audio-files)
- [Archive Files](#archive-files)
- [Vector Graphics](#vector-graphics)
- [Unsupported Files](#unsupported-files)
- [Browser Compatibility](#browser-compatibility)

---

## Quick Reference

| File Type | Extensions | Preview | Download | Thumbnail | Modal Viewer | Default Action |
|-----------|-----------|---------|----------|-----------|--------------|----------------|
| Images | jpg, png, gif, webp, svg, bmp | ✅ | ✅ | ✅ | ✅ Image Modal | Open in Modal |
| Videos | mp4, webm, mov, mkv | ✅ | ✅ | ✅ | ✅ Video Player | Open in Modal |
| PDFs | pdf | ✅ | ✅ | ✅ | ⚠️ Optional | Open in New Tab |
| Documents | docx, doc, txt, rtf | ❌ | ✅ | ⚠️ Server-gen | ❌ | Download |
| Spreadsheets | xlsx, xls, csv | ❌ | ✅ | ⚠️ Server-gen | ❌ | Download |
| Presentations | pptx, ppt | ❌ | ✅ | ⚠️ Server-gen | ❌ | Download |
| Audio | mp3, wav, flac, aac | ⚠️ Future | ✅ | ❌ | ⚠️ Future | Download |
| Archives | zip, rar, 7z | ❌ | ✅ | ❌ | ❌ | Download |
| Vector | eps, ai | ⚠️ If thumb | ✅ | ⚠️ Server-gen | ⚠️ If thumb | Download |
| Other | All others | ❌ | ✅ | ❌ | ❌ | Download |

**Legend:**
- ✅ Fully Supported
- ⚠️ Conditionally Supported / Requires Backend
- ❌ Not Supported

---

## Image Files

### Supported Formats

| Format | Extension | MIME Type | Preview | Thumbnail | Notes |
|--------|-----------|-----------|---------|-----------|-------|
| JPEG | `.jpg`, `.jpeg` | `image/jpeg` | ✅ | ✅ | Most common format |
| PNG | `.png` | `image/png` | ✅ | ✅ | Supports transparency |
| GIF | `.gif` | `image/gif` | ✅ | ✅ | Animated GIFs supported |
| WebP | `.webp` | `image/webp` | ✅ | ✅ | Modern, efficient format |
| SVG | `.svg` | `image/svg+xml` | ✅ | ✅ | Vector format, scalable |
| BMP | `.bmp` | `image/bmp` | ✅ | ✅ | Uncompressed format |
| ICO | `.ico` | `image/x-icon` | ✅ | ✅ | Icon files |
| TIFF | `.tiff`, `.tif` | `image/tiff` | ⚠️ | ⚠️ | Limited browser support |

### Capabilities

**Preview:**
- Opens in image modal viewer
- Full-screen display
- Zoom controls (25% - 500%)
- Gallery navigation (if multiple images)
- Keyboard shortcuts
- Touch gestures (mobile)

**Thumbnails:**
- Automatically generated
- Three sizes: small (150px), medium (300px), large (600px)
- Cached for performance
- Lazy loading support

**Supported Operations:**
- View in modal
- Download original
- Zoom in/out
- Navigate gallery
- Share (if implemented)

### Limitations

- Maximum recommended size: 50MB
- Very large images (>4000x4000px) may load slowly
- Animated GIFs play but can't be controlled
- TIFF support varies by browser
- EXIF rotation may not be handled automatically

### Browser Support

| Browser | JPEG | PNG | GIF | WebP | SVG | BMP | TIFF |
|---------|------|-----|-----|------|-----|-----|------|
| Chrome | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Firefox | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Safari | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Edge | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## Video Files

### Supported Formats

| Format | Extension | MIME Type | Preview | Thumbnail | Notes |
|--------|-----------|-----------|---------|-----------|-------|
| MP4 | `.mp4`, `.m4v` | `video/mp4` | ✅ | ✅ | Best compatibility |
| WebM | `.webm` | `video/webm` | ✅ | ✅ | Open format |
| AVI | `.avi` | `video/x-msvideo` | ⚠️ | ⚠️ | Limited browser support |
| MOV | `.mov` | `video/quicktime` | ⚠️ | ⚠️ | Limited browser support |
| WMV | `.wmv` | `video/x-ms-wmv` | ❌ | ⚠️ | Not supported in browser |
| FLV | `.flv` | `video/x-flv` | ❌ | ⚠️ | Not supported in browser |
| MKV | `.mkv` | `video/x-matroska` | ⚠️ | ⚠️ | Limited browser support |

### Capabilities

**Preview:**
- Opens in video player modal
- Custom controls (play/pause, seek, volume)
- Fullscreen mode
- Keyboard shortcuts
- Progress bar
- Time display

**Video Player Features:**
- Play/Pause
- Volume control with mute
- Seek bar
- Fullscreen toggle
- Download button
- Time display (current / total)
- Auto-hide controls
- Keyboard navigation

**Thumbnails:**
- Server-generated from first frame
- Falls back to video icon if generation fails

**Supported Operations:**
- Play in modal
- Play inline (optional)
- Download original
- Fullscreen playback
- Seek to timestamp

### Codec Support

**Video Codecs:**
- H.264 (AVC) ✅ - Best compatibility
- H.265 (HEVC) ⚠️ - Limited browser support
- VP8 ✅ - WebM format
- VP9 ✅ - WebM format
- AV1 ⚠️ - New, limited support

**Audio Codecs:**
- AAC ✅ - Most common
- MP3 ✅ - Universal
- Opus ✅ - WebM format
- Vorbis ✅ - Open format

### Limitations

- Maximum recommended size: 500MB
- 4K videos may not play smoothly on all devices
- Codec support varies by browser
- No subtitle support (yet)
- No multiple audio track selection
- Streaming optimization depends on server setup

### Browser Support

| Browser | MP4 (H.264) | WebM (VP8/VP9) | AVI | MOV |
|---------|-------------|----------------|-----|-----|
| Chrome | ✅ | ✅ | ❌ | ⚠️ |
| Firefox | ✅ | ✅ | ❌ | ❌ |
| Safari | ✅ | ⚠️ | ❌ | ✅ |
| Edge | ✅ | ✅ | ❌ | ⚠️ |

### Recommended Format

**Best for web:** MP4 with H.264 video and AAC audio
- Universal browser support
- Good quality-to-size ratio
- Hardware acceleration available

---

## PDF Files

### Supported Format

| Format | Extension | MIME Type | Preview | Thumbnail | Notes |
|--------|-----------|-----------|---------|-----------|-------|
| PDF | `.pdf` | `application/pdf` | ✅ | ✅ | Universal document format |

### Capabilities

**Preview:**
- Opens in new browser tab (default)
- Optional: Modal viewer (if implemented)
- Optional: Inline viewer (if implemented)
- Browser's native PDF viewer

**View Modes:**

1. **New Tab (Default):**
   - Opens PDF in new browser tab
   - Uses browser's built-in PDF viewer
   - Best for large PDFs
   - Preserves features (search, print, etc.)

2. **Modal (Optional):**
   - Opens PDF in modal overlay
   - Custom toolbar (if implemented)
   - Better UX for small PDFs
   - Size limit: 50MB (configurable)

3. **Inline (Optional):**
   - Embeds PDF in page
   - Good for preview snippets
   - Size limit: 10MB recommended

**Thumbnails:**
- Server-generated from first page
- Multiple sizes available
- Cached for performance

**Supported Operations:**
- View in browser
- Download original
- Print (browser native)
- Search (browser native)

### PDF-Specific Configuration

```typescript
const config = {
  pdfViewMode: 'new-tab' | 'modal' | 'inline',
  pdfMaxFileSize: 50 * 1024 * 1024  // 50MB
};
```

### Limitations

- Very large PDFs (>100MB) always open in new tab
- Encrypted PDFs may require password (browser handles)
- Interactive forms work in browser, not in modal
- Annotations not supported in modal viewer
- Digital signatures shown but not validated

### Browser Support

All modern browsers have native PDF support:
- Chrome ✅
- Firefox ✅
- Safari ✅
- Edge ✅

### Recommended Usage

- **Small PDFs (<5MB):** Any mode works
- **Medium PDFs (5-50MB):** New tab or modal
- **Large PDFs (>50MB):** New tab only
- **Interactive PDFs:** New tab only

---

## Document Files

### Supported Formats

| Format | Extension | MIME Type | Preview | Download | Thumbnail |
|--------|-----------|-----------|---------|----------|-----------|
| Word (Modern) | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | ❌ | ✅ | ⚠️ |
| Word (Legacy) | `.doc` | `application/msword` | ❌ | ✅ | ⚠️ |
| Text | `.txt` | `text/plain` | ❌ | ✅ | ❌ |
| Rich Text | `.rtf` | `application/rtf` | ❌ | ✅ | ⚠️ |
| OpenDocument | `.odt` | `application/vnd.oasis.opendocument.text` | ❌ | ✅ | ⚠️ |

### Capabilities

**Preview:**
- No native browser preview
- Thumbnails generated server-side (if available)
- Download is primary action

**Thumbnails:**
- Requires server-side processing
- First page snapshot
- May not be available for all documents

**Supported Operations:**
- Download to local system
- View thumbnail (if available)
- Open in external application

### Limitations

- No in-browser preview
- Requires desktop application to view
- Thumbnail generation depends on backend service
- Complex formatting may not render in thumbnail

### Future Enhancements

- Office 365 integration for preview
- Google Docs viewer integration
- LibreOffice Online integration

---

## Spreadsheet Files

### Supported Formats

| Format | Extension | MIME Type | Preview | Download | Thumbnail |
|--------|-----------|-----------|---------|----------|-----------|
| Excel (Modern) | `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | ❌ | ✅ | ⚠️ |
| Excel (Legacy) | `.xls` | `application/vnd.ms-excel` | ❌ | ✅ | ⚠️ |
| CSV | `.csv` | `text/csv` | ❌ | ✅ | ❌ |
| OpenDocument | `.ods` | `application/vnd.oasis.opendocument.spreadsheet` | ❌ | ✅ | ⚠️ |

### Capabilities

**Preview:**
- No native browser preview
- CSV files could be previewed with custom component (future)
- Thumbnails generated server-side (if available)

**Supported Operations:**
- Download to local system
- View thumbnail (if available)
- Open in external application

### CSV Special Handling

CSV files are text-based and could support:
- Preview with custom table component (future)
- Quick data viewing without download
- Export to different formats

---

## Presentation Files

### Supported Formats

| Format | Extension | MIME Type | Preview | Download | Thumbnail |
|--------|-----------|-----------|---------|----------|-----------|
| PowerPoint (Modern) | `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | ❌ | ✅ | ⚠️ |
| PowerPoint (Legacy) | `.ppt` | `application/vnd.ms-powerpoint` | ❌ | ✅ | ⚠️ |
| OpenDocument | `.odp` | `application/vnd.oasis.opendocument.presentation` | ❌ | ✅ | ⚠️ |

### Capabilities

**Preview:**
- No native browser preview
- Thumbnails show first slide (server-generated)

**Supported Operations:**
- Download to local system
- View thumbnail (if available)
- Open in external application

---

## Audio Files

### Supported Formats

| Format | Extension | MIME Type | Preview | Download | Status |
|--------|-----------|-----------|---------|----------|--------|
| MP3 | `.mp3` | `audio/mpeg` | ⚠️ | ✅ | Future |
| WAV | `.wav` | `audio/wav` | ⚠️ | ✅ | Future |
| FLAC | `.flac` | `audio/flac` | ⚠️ | ✅ | Future |
| AAC | `.aac`, `.m4a` | `audio/aac` | ⚠️ | ✅ | Future |
| OGG | `.ogg` | `audio/ogg` | ⚠️ | ✅ | Future |

### Current Behavior

- Primary action: Download
- No inline player (yet)
- No thumbnails

### Future Audio Player

Planned features:
- Inline audio player
- Play/pause controls
- Volume control
- Progress bar
- Playlist support
- Waveform visualization

---

## Archive Files

### Supported Formats

| Format | Extension | MIME Type | Preview | Download | Notes |
|--------|-----------|-----------|---------|----------|-------|
| ZIP | `.zip` | `application/zip` | ❌ | ✅ | Most common |
| RAR | `.rar` | `application/x-rar-compressed` | ❌ | ✅ | Proprietary |
| 7-Zip | `.7z` | `application/x-7z-compressed` | ❌ | ✅ | Open format |
| TAR | `.tar` | `application/x-tar` | ❌ | ✅ | Unix archive |
| GZIP | `.gz` | `application/gzip` | ❌ | ✅ | Compressed |
| BZIP2 | `.bz2` | `application/x-bzip2` | ❌ | ✅ | Compressed |

### Capabilities

**Current:**
- Download only
- Icon display
- File size information

**Future Enhancements:**
- Archive content listing
- Extract individual files
- Preview files within archive
- Virtual file system

---

## Vector Graphics

### Supported Formats

| Format | Extension | MIME Type | Preview | Download | Notes |
|--------|-----------|-----------|---------|----------|-------|
| EPS | `.eps` | `application/postscript` | ⚠️ | ✅ | Requires thumbnail |
| AI | `.ai` | `application/illustrator` | ⚠️ | ✅ | Adobe Illustrator |
| SVG | `.svg` | `image/svg+xml` | ✅ | ✅ | Web-native vector |

### EPS/AI Handling

**Preview Requirements:**
- Requires server-side thumbnail generation
- Thumbnail created during upload
- If thumbnail exists: Preview available
- If no thumbnail: Download only

**SVG:**
- Native browser support
- Displays as image
- Scales perfectly
- Security: Scripts disabled in viewer

---

## Unsupported Files

### Files That Require Download

Any file type not listed above defaults to download:
- Executable files (`.exe`, `.app`, `.bin`)
- System files (`.dll`, `.sys`)
- Database files (`.db`, `.sqlite`)
- Compiled code (`.class`, `.jar`)
- Source code (`.js`, `.py`, `.java`) - could support preview (future)
- And many others

### Security-Restricted Files

These files trigger security warnings:
- `.exe`, `.bat`, `.cmd`, `.com` - Executables
- `.js`, `.vbs`, `.wsh` - Scripts
- `.html`, `.htm` - HTML files (XSS risk)
- Files with path traversal attempts

---

## Browser Compatibility

### Desktop Browsers

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Image Preview | ✅ | ✅ | ✅ | ✅ |
| Video Preview | ✅ | ✅ | ⚠️ Codecs | ✅ |
| PDF Preview | ✅ | ✅ | ✅ | ✅ |
| SVG Display | ✅ | ✅ | ✅ | ✅ |
| WebP Support | ✅ | ✅ | ✅ | ✅ |
| WebM Support | ✅ | ✅ | ⚠️ Limited | ✅ |
| HEVC Video | ❌ | ❌ | ✅ | ⚠️ |

### Mobile Browsers

| Feature | iOS Safari | Chrome Android | Samsung Internet |
|---------|------------|----------------|------------------|
| Image Preview | ✅ | ✅ | ✅ |
| Video Preview | ✅ | ✅ | ✅ |
| PDF Preview | ✅ | ✅ | ✅ |
| Touch Gestures | ✅ | ✅ | ✅ |
| File Download | ✅ | ✅ | ✅ |

### Minimum Browser Versions

- Chrome: 90+
- Firefox: 88+
- Safari: 14+
- Edge: 90+
- iOS Safari: 14+
- Chrome Android: 90+

---

## Performance Recommendations

### File Size Guidelines

| File Type | Small | Medium | Large | Max Recommended |
|-----------|-------|--------|-------|-----------------|
| Images | <1MB | 1-5MB | 5-20MB | 50MB |
| Videos | <10MB | 10-100MB | 100-500MB | 1GB |
| PDFs | <1MB | 1-10MB | 10-50MB | 100MB |
| Documents | <1MB | 1-5MB | 5-20MB | 50MB |

### Thumbnail Sizes

| Size | Dimensions | Use Case | File Size |
|------|-----------|----------|-----------|
| Small | 150x150px | List view, thumbnails | <10KB |
| Medium | 300x300px | Grid view, cards | <30KB |
| Large | 600x600px | Preview, gallery | <100KB |

### Network Considerations

**Fast Connection (WiFi):**
- All file types and sizes work well
- Thumbnails load instantly
- Videos start playing immediately

**Slow Connection (3G):**
- Use smaller thumbnail sizes
- Lazy load thumbnails
- Show file size warnings
- Recommend download for large files

**Offline Mode:**
- Cached thumbnails available
- No new file loading
- Show appropriate error messages

---

## Future Enhancements

### Planned Support

1. **Audio Player:**
   - Inline playback
   - Playlist management
   - Waveform visualization

2. **Office Previewer:**
   - Word/Excel/PowerPoint preview
   - Integration with Office 365
   - LibreOffice Online

3. **Code Viewer:**
   - Syntax highlighting
   - Line numbers
   - Multiple languages

4. **Archive Browser:**
   - View archive contents
   - Extract individual files
   - Preview files in archive

5. **3D Model Viewer:**
   - `.obj`, `.stl`, `.gltf` support
   - Interactive 3D viewer
   - Material display

### Under Consideration

- Markdown preview
- JSON/XML formatted display
- CSV table viewer
- Video subtitle support
- Multi-track audio selection
- Animated GIF controls
- RAW image format support

---

## Troubleshooting

### Common Issues

**Image won't display:**
- Check MIME type matches extension
- Verify file isn't corrupted
- Check file size isn't excessive
- Ensure browser supports format

**Video won't play:**
- Check codec compatibility
- Try re-encoding to H.264/AAC MP4
- Verify file isn't too large
- Check browser console for errors

**PDF won't open:**
- Check file size (<100MB recommended)
- Verify PDF isn't corrupted
- Try different view mode
- Check browser's PDF settings

**Thumbnail not showing:**
- Verify thumbnail generation service running
- Check file type supports thumbnails
- Wait for background processing
- Check server logs for errors

---

## API Endpoints

### File Serving

```
GET /files/serve/{id}
```
Returns the raw file for browser display/download.

### File Download

```
GET /files/{id}/download
```
Returns the file with `Content-Disposition: attachment` header.

### Thumbnail Generation

```
GET /files/thumbnail/{id}?size={small|medium|large}
```
Returns generated thumbnail image.

**Parameters:**
- `size`: `small` (150px), `medium` (300px), `large` (600px)

---

## Summary

The File Viewer system provides comprehensive support for:
- ✅ **Full Preview:** Images, Videos, PDFs, SVG
- ⚠️ **Conditional Preview:** EPS (with thumbnails)
- ✅ **Thumbnails:** Images, Videos, PDFs, Documents (server-gen)
- ✅ **Download:** All file types
- 🔒 **Security:** Automatic validation and warnings

For the best user experience, use supported preview formats (images, videos, PDFs) and ensure proper thumbnail generation for other document types.
