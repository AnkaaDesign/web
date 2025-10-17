# File Viewer Testing Checklist

Comprehensive testing checklist for the file viewer system components.

## Table of Contents
- [Testing Environment Setup](#testing-environment-setup)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [Manual Testing Scenarios](#manual-testing-scenarios)
- [Performance Testing](#performance-testing)
- [Security Testing](#security-testing)
- [Accessibility Testing](#accessibility-testing)
- [Cross-Browser Testing](#cross-browser-testing)
- [Mobile/Responsive Testing](#mobile-responsive-testing)

---

## Testing Environment Setup

### Prerequisites
- [ ] Node.js v18+ installed
- [ ] Test files prepared in `/tests/fixtures/` directory
- [ ] API server running (for integration tests)
- [ ] Browser testing tools configured

### Test Data Preparation
Create a comprehensive test file collection:

```bash
# Create test fixtures directory
mkdir -p tests/fixtures/files

# Add sample files for each type:
# - Images: test.jpg, test.png, test.gif, test.webp, test.svg, test.bmp
# - Videos: test.mp4, test.webm, test.mov
# - PDFs: test.pdf, large.pdf (>50MB), small.pdf (<1MB)
# - Documents: test.docx, test.txt, test.rtf
# - Spreadsheets: test.xlsx, test.csv
# - Presentations: test.pptx
# - Audio: test.mp3, test.wav
# - Archives: test.zip, test.rar
# - Vector: test.eps, test.ai, test.svg
# - Other: test.exe, test.js, test.html (for security testing)
```

### Test File Requirements
- [ ] Valid files for each supported type
- [ ] Corrupted/invalid files for error testing
- [ ] Large files (>100MB) for performance testing
- [ ] Small files (<1KB) for edge case testing
- [ ] Files with special characters in names
- [ ] Files without extensions
- [ ] Files with wrong extensions (e.g., .jpg file that's actually a .png)

---

## Unit Tests

### File Type Detection Tests

#### `detectFileType` Function
- [ ] Correctly identifies image files (JPEG, PNG, GIF, WEBP, SVG, BMP)
- [ ] Correctly identifies video files (MP4, WEBM, AVI, MOV, MKV)
- [ ] Correctly identifies PDF files
- [ ] Correctly identifies document files (DOCX, DOC, TXT, RTF)
- [ ] Correctly identifies spreadsheet files (XLSX, CSV)
- [ ] Correctly identifies presentation files (PPTX, PPT)
- [ ] Correctly identifies audio files (MP3, WAV, FLAC, AAC)
- [ ] Correctly identifies archive files (ZIP, RAR, 7Z)
- [ ] Correctly identifies vector files (EPS, AI, SVG)
- [ ] Returns "other" for unknown file types
- [ ] Handles files without extensions
- [ ] Handles files with incorrect MIME types
- [ ] Handles null/undefined filename
- [ ] Handles null/undefined mimetype

#### `detectFileCategory` Function
- [ ] Returns correct category for each file type
- [ ] Handles edge cases (no extension, no mimetype)
- [ ] Prioritizes MIME type over extension
- [ ] Falls back to extension when MIME type is unavailable

### Security Validation Tests

#### `validateFileSecurity` Function
- [ ] Detects dangerous file extensions (.exe, .bat, .cmd, etc.)
- [ ] Detects XSS-dangerous MIME types (text/html, application/javascript)
- [ ] Validates file size against maxFileSize config
- [ ] Detects path traversal attempts (../, ..\\)
- [ ] Returns isSecure: false for dangerous files
- [ ] Returns appropriate warning messages
- [ ] Respects enableSecurity config option
- [ ] Handles config.enableSecurity = false (permissive mode)
- [ ] Handles missing config (uses defaults)
- [ ] Handles edge cases (0-byte files, extremely large files)

### URL Generation Tests

#### `generateFileUrls` Function
- [ ] Generates correct serve URL
- [ ] Generates correct download URL
- [ ] Generates correct thumbnail URLs (small, medium, large)
- [ ] Handles existing thumbnailUrl in file object
- [ ] Handles absolute vs. relative thumbnail URLs
- [ ] Uses baseUrl when provided
- [ ] Falls back to default API URL when baseUrl not provided
- [ ] Handles missing baseUrl gracefully
- [ ] Returns null for thumbnail when not available

### File View Action Tests

#### `determineFileViewAction` Function
- [ ] Returns "modal" action for images
- [ ] Returns "new-tab" action for PDFs
- [ ] Returns "modal" action for videos
- [ ] Returns "inline" action for audio files
- [ ] Returns "download" action for documents
- [ ] Returns "download" action for archives
- [ ] Returns "download" action for insecure files (when security enabled)
- [ ] Returns "modal" action for EPS with thumbnail
- [ ] Returns "download" action for EPS without thumbnail
- [ ] Includes security info in response
- [ ] Respects config options

#### `executeFileViewAction` Function
- [ ] Calls onModalOpen for "modal" actions
- [ ] Opens new tab for "new-tab" actions
- [ ] Calls onInlinePlayer for "inline" actions
- [ ] Calls onDownload for "download" actions
- [ ] Calls onSecurityWarning when warnings present
- [ ] Handles missing callbacks gracefully
- [ ] Creates download link when onDownload not provided
- [ ] Adds proper attributes to new tab links (target="_blank", rel="noopener")

### Main Service Function Tests

#### `viewFile` Function
- [ ] Combines determineFileViewAction and executeFileViewAction
- [ ] Passes config correctly
- [ ] Passes options correctly
- [ ] Returns action result
- [ ] Handles all file types correctly

#### `canPreviewFile` Function
- [ ] Returns true for images
- [ ] Returns true for videos
- [ ] Returns true for PDFs
- [ ] Returns true for EPS with thumbnails
- [ ] Returns false for documents
- [ ] Returns false for archives
- [ ] Returns false for EPS without thumbnails
- [ ] Returns false for unknown types

---

## Integration Tests

### FileViewerProvider Tests

#### Provider Setup
- [ ] Provider wraps children correctly
- [ ] Context is accessible to child components
- [ ] Throws error when useFileViewer used outside provider
- [ ] Merges config with defaults correctly
- [ ] Passes baseUrl to service

#### State Management
- [ ] Initial state is correct
- [ ] openImageModal updates state correctly
- [ ] closeImageModal resets state correctly
- [ ] openVideoModal updates state correctly
- [ ] closeVideoModal resets state correctly
- [ ] State updates trigger re-renders

#### Modal Rendering
- [ ] Image modal renders when isImageModalOpen is true
- [ ] Image modal doesn't render when isImageModalOpen is false
- [ ] Video modal renders when isVideoModalOpen is true
- [ ] Video modal doesn't render when isVideoModalOpen is false
- [ ] Modals receive correct props
- [ ] Modals close when onOpenChange(false) called

#### File Actions
- [ ] viewFile calls fileViewerService correctly
- [ ] viewFile opens image modal for images
- [ ] viewFile opens video modal for videos
- [ ] viewFile opens PDFs in new tab
- [ ] viewFile downloads documents
- [ ] viewFile shows security warnings
- [ ] downloadFile generates correct download link
- [ ] downloadFile calls custom onDownload when provided
- [ ] downloadFile shows success toast

### useFileViewer Hook Tests
- [ ] Returns context value
- [ ] Provides state object
- [ ] Provides actions object
- [ ] Actions work correctly
- [ ] Throws error outside provider

### useFileViewerStandalone Hook Tests
- [ ] Works without provider
- [ ] Merges config correctly
- [ ] viewFile function works
- [ ] canPreview function works
- [ ] getFileAction function works
- [ ] downloadFile function works
- [ ] Returns config object

### FileViewerButton Tests
- [ ] Renders children correctly
- [ ] Applies className prop
- [ ] Handles click events
- [ ] Disabled state works
- [ ] Uses context when available
- [ ] Falls back to standalone when context not available
- [ ] Prevents default on click
- [ ] Stops propagation when needed

### FileViewerCard Tests

#### Rendering
- [ ] Renders card structure correctly
- [ ] Shows file thumbnail when available
- [ ] Shows fallback icon when thumbnail unavailable
- [ ] Shows loading state during thumbnail load
- [ ] Shows error state on thumbnail error
- [ ] Displays file name when showName=true
- [ ] Displays file size when showSize=true
- [ ] Displays file type badge when showType=true
- [ ] Respects size prop (sm, md, lg)
- [ ] Applies custom className

#### Interactions
- [ ] Hover effects work when enableHover=true
- [ ] Shows action buttons on hover
- [ ] Preview button appears for previewable files
- [ ] Download button always appears
- [ ] Click opens file viewer
- [ ] Preview button opens preview
- [ ] Download button downloads file
- [ ] Disabled state prevents interactions
- [ ] Custom onClick handler works
- [ ] Custom onDownload handler works

#### File Type Detection
- [ ] Detects all supported file types correctly
- [ ] Generates correct thumbnail URLs
- [ ] Shows correct icons for each type
- [ ] Shows correct type labels

### FilePreview Tests

#### Modal Behavior
- [ ] Opens when open=true
- [ ] Closes when open=false
- [ ] Calls onOpenChange on close
- [ ] ESC key closes modal
- [ ] Click on overlay closes modal

#### Image Display
- [ ] Loads and displays images
- [ ] Shows loading state
- [ ] Calculates fit zoom correctly
- [ ] Centers image in viewport
- [ ] Handles image load errors
- [ ] Shows error message for failed loads

#### Gallery Navigation
- [ ] Arrow buttons navigate between images
- [ ] Arrow keys navigate between images
- [ ] Shows correct image counter (1 of N)
- [ ] Loops from last to first image
- [ ] Loops from first to last image
- [ ] Navigation disabled for single image
- [ ] Thumbnail strip shows all images
- [ ] Clicking thumbnail navigates to image
- [ ] Active thumbnail highlighted

#### Zoom Controls
- [ ] Zoom in button works
- [ ] Zoom out button works
- [ ] Reset zoom (0 key) works
- [ ] +/= keys zoom in
- [ ] - key zooms out
- [ ] Zoom percentage displays correctly
- [ ] Zoom disabled at max/min levels
- [ ] Click to zoom in works
- [ ] Click to zoom out works

#### File Actions
- [ ] Download button works
- [ ] Open PDF button works (for PDFs)
- [ ] Shows file name and size
- [ ] Shows image count for galleries

#### Special File Types
- [ ] Handles EPS files with thumbnails
- [ ] Shows special border for EPS
- [ ] Shows download option for EPS without thumbnails
- [ ] Shows appropriate message for non-previewable files
- [ ] PDF opens in new tab

### VideoPlayer Tests

#### Modal Mode
- [ ] Renders in modal when mode="modal"
- [ ] Opens/closes based on open prop
- [ ] ESC key closes modal
- [ ] Shows file info overlay
- [ ] Fullscreen mode works

#### Inline Mode
- [ ] Renders in card when mode="inline"
- [ ] Maintains aspect ratio
- [ ] No close button in inline mode

#### Playback Controls
- [ ] Play/pause button works
- [ ] Spacebar toggles play/pause
- [ ] Progress bar updates during playback
- [ ] Clicking progress bar seeks
- [ ] Time display shows current/total time
- [ ] Arrow left seeks backward
- [ ] Arrow right seeks forward

#### Volume Controls
- [ ] Mute button works
- [ ] M key toggles mute
- [ ] Volume slider works
- [ ] Volume persists when unmuted
- [ ] Volume icon changes based on level

#### Display Controls
- [ ] Fullscreen toggle works
- [ ] F key toggles fullscreen
- [ ] Controls auto-hide during playback
- [ ] Controls show on mouse move
- [ ] Controls always visible when paused

#### Video Loading
- [ ] Shows loading state
- [ ] Shows error state on load failure
- [ ] Preloads metadata
- [ ] Handles unsupported formats

#### Download
- [ ] Download button works
- [ ] Custom onDownload handler works
- [ ] Default download creates link

---

## Manual Testing Scenarios

### Image File Testing

#### Standard Images
- [ ] JPEG image loads and displays correctly
- [ ] PNG image (with transparency) displays correctly
- [ ] GIF (animated) displays correctly
- [ ] WEBP image displays correctly
- [ ] SVG image displays correctly (vector scaling)
- [ ] BMP image displays correctly
- [ ] TIFF image displays correctly

#### Image Scenarios
- [ ] Small image (100x100px) fits viewport
- [ ] Large image (4000x3000px) fits viewport with zoom
- [ ] Portrait orientation image displays correctly
- [ ] Landscape orientation image displays correctly
- [ ] Square image displays correctly
- [ ] Image with EXIF rotation displays correctly
- [ ] Progressive JPEG loads correctly
- [ ] Image with ICC color profile displays correctly

#### Gallery Testing
- [ ] Gallery with 2 images
- [ ] Gallery with 10 images
- [ ] Gallery with 100+ images (performance)
- [ ] Gallery with mixed file types (images + non-images)
- [ ] Gallery navigation smooth and responsive

### Video File Testing

#### Standard Videos
- [ ] MP4 video plays correctly
- [ ] WEBM video plays correctly
- [ ] MOV video plays correctly
- [ ] MKV video plays correctly

#### Video Scenarios
- [ ] Short video (<30s) plays completely
- [ ] Long video (>10min) plays and seeks correctly
- [ ] 4K video plays (may be slow)
- [ ] Video with subtitles (if supported)
- [ ] Video with multiple audio tracks
- [ ] Portrait video (vertical) displays correctly
- [ ] Square video (1:1) displays correctly
- [ ] Video without audio plays silently

#### Playback Testing
- [ ] Play/pause works smoothly
- [ ] Seeking to different timestamps works
- [ ] Playing to completion works
- [ ] Loop functionality (if implemented)
- [ ] Playback speed controls (if implemented)
- [ ] Picture-in-picture (if implemented)

### PDF File Testing

#### Standard PDFs
- [ ] Simple PDF (text only) opens in new tab
- [ ] PDF with images opens correctly
- [ ] PDF with forms displays correctly
- [ ] Multi-page PDF (100+ pages) opens
- [ ] Encrypted PDF handling
- [ ] PDF with bookmarks

#### PDF Scenarios
- [ ] Small PDF (<1MB) loads quickly
- [ ] Large PDF (>50MB) loads (may be slow)
- [ ] PDF opens in new tab (not downloaded)
- [ ] PDF can be printed from browser
- [ ] PDF can be saved from browser

### Document File Testing

#### Document Types
- [ ] DOCX file downloads
- [ ] DOC file downloads
- [ ] TXT file downloads
- [ ] RTF file downloads
- [ ] ODT file downloads

#### Document Scenarios
- [ ] Document with special characters in name
- [ ] Document with very long filename
- [ ] Empty document (0 bytes) - should error gracefully
- [ ] Corrupted document - should error gracefully

### Spreadsheet File Testing
- [ ] XLSX file downloads
- [ ] XLS file downloads
- [ ] CSV file downloads
- [ ] Large spreadsheet (>10MB) downloads
- [ ] Spreadsheet with multiple sheets

### Presentation File Testing
- [ ] PPTX file downloads
- [ ] PPT file downloads
- [ ] Presentation with embedded media

### Audio File Testing
- [ ] MP3 file plays (if audio player implemented)
- [ ] WAV file plays
- [ ] FLAC file plays
- [ ] AAC file plays
- [ ] Audio playback controls work

### Archive File Testing
- [ ] ZIP file downloads
- [ ] RAR file downloads
- [ ] 7Z file downloads
- [ ] Large archive (>100MB) downloads
- [ ] Password-protected archive downloads

### Vector File Testing
- [ ] EPS with thumbnail previews
- [ ] EPS without thumbnail downloads
- [ ] AI file handling
- [ ] SVG displays as image

### Error Scenarios

#### File Errors
- [ ] Missing file (404) shows error
- [ ] Corrupted image shows error state
- [ ] Corrupted video shows error state
- [ ] Invalid PDF shows error
- [ ] Network timeout handled gracefully
- [ ] Server error (500) handled

#### Edge Cases
- [ ] File with no extension
- [ ] File with wrong extension (e.g., .jpg but actually .png)
- [ ] File with special characters in name: `test (1).pdf`, `test's file.jpg`
- [ ] File with unicode characters: `テスト.pdf`, `файл.jpg`
- [ ] File with very long name (>255 chars)
- [ ] File with only spaces in name
- [ ] Multiple files with same name
- [ ] 0-byte file

### Security Scenarios

#### Dangerous Files
- [ ] .exe file shows security warning
- [ ] .bat file shows security warning
- [ ] .js file shows security warning
- [ ] HTML file shows security warning
- [ ] File with path traversal attempt blocked

#### Security Config
- [ ] Security enabled: dangerous files force download
- [ ] Security disabled: files open normally
- [ ] Custom maxFileSize respected
- [ ] Security warnings display correctly
- [ ] Custom onSecurityWarning callback works

---

## Performance Testing

### Load Performance
- [ ] Initial page load time acceptable (<2s)
- [ ] Component mount time acceptable (<500ms)
- [ ] Time to first thumbnail display (<1s)

### Thumbnail Loading
- [ ] Thumbnails load progressively (lazy loading)
- [ ] Thumbnail loading doesn't block UI
- [ ] Failed thumbnails don't affect other thumbnails
- [ ] Thumbnail cache works (no re-fetching)

### Large File Handling
- [ ] Large image (>10MB) loads without freezing
- [ ] Large video (>500MB) starts playing quickly
- [ ] Large PDF (>50MB) opens in new tab
- [ ] Large file download doesn't freeze UI
- [ ] Progress indication for large operations

### Gallery Performance
- [ ] Gallery with 100+ images scrolls smoothly
- [ ] Navigation between images is instant (<100ms)
- [ ] Thumbnail strip scrolls smoothly
- [ ] Memory usage acceptable (no leaks)

### Video Performance
- [ ] Video starts playing within 2 seconds
- [ ] Seeking is responsive (<500ms)
- [ ] Controls are responsive
- [ ] No frame drops during playback
- [ ] Multiple videos don't interfere

### Memory Management
- [ ] No memory leaks when opening/closing modals
- [ ] Images unloaded when modal closed
- [ ] Video stops when modal closed
- [ ] Event listeners cleaned up
- [ ] Component unmount cleanup works

### Network Performance
- [ ] Files load over slow 3G connection
- [ ] Files load over fast WiFi connection
- [ ] Offline mode handled gracefully
- [ ] Request cancellation works
- [ ] Retry logic for failed requests

---

## Security Testing

### Input Validation
- [ ] Filename sanitization works
- [ ] Path traversal attempts blocked
- [ ] XSS attempts in filename blocked
- [ ] SQL injection in filename blocked

### File Type Validation
- [ ] MIME type validation works
- [ ] Extension validation works
- [ ] Mismatch between MIME and extension detected
- [ ] Executable files blocked
- [ ] Script files blocked

### Access Control
- [ ] Unauthorized file access returns 401/403
- [ ] File permissions respected
- [ ] User can only access own files
- [ ] Admin can access all files (if applicable)

### Content Security
- [ ] SVG files sanitized (no embedded scripts)
- [ ] HTML files can't execute scripts
- [ ] iframes sandboxed properly
- [ ] No eval() or Function() usage

### Data Protection
- [ ] File URLs expire after time (if implemented)
- [ ] Download URLs require authentication
- [ ] Sensitive files encrypted at rest (backend)
- [ ] No file data in logs

---

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab navigation works through all controls
- [ ] Enter/Space activate buttons
- [ ] ESC closes modals
- [ ] Arrow keys navigate gallery
- [ ] +/- keys zoom images
- [ ] Focus visible on all interactive elements
- [ ] Focus trap in modals
- [ ] No keyboard traps

### Screen Reader Support
- [ ] File names announced
- [ ] File types announced
- [ ] File sizes announced
- [ ] Button labels announced
- [ ] Image alt text present
- [ ] Modal labels present (aria-label, aria-describedby)
- [ ] Loading states announced
- [ ] Error states announced

### Visual Accessibility
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Focus indicators visible
- [ ] Icons have text alternatives
- [ ] Loading indicators visible
- [ ] Error messages visible and clear
- [ ] Hover states don't rely solely on color

### ARIA Attributes
- [ ] role attributes correct
- [ ] aria-label on icon buttons
- [ ] aria-describedby on modals
- [ ] aria-live for dynamic content
- [ ] aria-disabled on disabled buttons
- [ ] aria-expanded for collapsible content

### Responsive Text
- [ ] Text scales with browser zoom (200%)
- [ ] Text doesn't truncate important info
- [ ] Text wraps appropriately
- [ ] Font sizes meet minimum requirements

---

## Cross-Browser Testing

### Desktop Browsers

#### Chrome (Latest)
- [ ] All features work
- [ ] Performance acceptable
- [ ] No console errors

#### Firefox (Latest)
- [ ] All features work
- [ ] Performance acceptable
- [ ] No console errors

#### Safari (Latest)
- [ ] All features work
- [ ] Performance acceptable
- [ ] No console errors
- [ ] Video codecs supported

#### Edge (Latest)
- [ ] All features work
- [ ] Performance acceptable
- [ ] No console errors

#### Opera
- [ ] All features work
- [ ] Performance acceptable

### Mobile Browsers

#### Safari iOS
- [ ] Touch interactions work
- [ ] Gestures work (pinch zoom)
- [ ] Video playback works
- [ ] File downloads work

#### Chrome Android
- [ ] Touch interactions work
- [ ] Gestures work
- [ ] Video playback works
- [ ] File downloads work

#### Samsung Internet
- [ ] All features work
- [ ] Performance acceptable

### Legacy Browsers (if supported)

#### Chrome -2 versions
- [ ] Core functionality works
- [ ] Graceful degradation

#### Firefox -2 versions
- [ ] Core functionality works
- [ ] Graceful degradation

---

## Mobile/Responsive Testing

### Device Testing

#### Smartphones
- [ ] iPhone SE (375x667)
- [ ] iPhone 12/13 (390x844)
- [ ] iPhone 14 Pro Max (430x932)
- [ ] Samsung Galaxy S21 (360x800)
- [ ] Google Pixel 6 (411x915)

#### Tablets
- [ ] iPad Mini (768x1024)
- [ ] iPad Pro 11" (834x1194)
- [ ] iPad Pro 12.9" (1024x1366)
- [ ] Samsung Galaxy Tab (800x1280)

#### Desktop
- [ ] 1366x768 (common laptop)
- [ ] 1920x1080 (full HD)
- [ ] 2560x1440 (2K)
- [ ] 3840x2160 (4K)

### Layout Testing

#### Mobile (320px - 767px)
- [ ] FileViewerCard displays correctly
- [ ] Thumbnails appropriately sized
- [ ] Text doesn't overflow
- [ ] Buttons accessible
- [ ] Modal fills screen
- [ ] Gallery navigation works
- [ ] Video controls accessible
- [ ] Zoom controls work

#### Tablet (768px - 1023px)
- [ ] Two-column grid works
- [ ] Thumbnails appropriately sized
- [ ] Modal size appropriate
- [ ] Touch targets large enough (44x44px min)

#### Desktop (1024px+)
- [ ] Multi-column grid works
- [ ] Hover effects work
- [ ] Modal size appropriate
- [ ] Keyboard navigation smooth

### Touch Interactions

#### Gestures
- [ ] Tap to open file
- [ ] Double tap to zoom (images)
- [ ] Pinch to zoom (images)
- [ ] Swipe to navigate (gallery)
- [ ] Long press (if applicable)

#### Touch Targets
- [ ] All buttons at least 44x44px
- [ ] Adequate spacing between targets
- [ ] No accidental taps

### Orientation Testing
- [ ] Portrait mode works correctly
- [ ] Landscape mode works correctly
- [ ] Orientation change doesn't break layout
- [ ] Orientation change doesn't stop video
- [ ] Modal adapts to orientation

### Mobile-Specific Features
- [ ] Native file download works
- [ ] Share functionality (if implemented)
- [ ] Camera integration (if applicable)
- [ ] Native video player (if used)

### Performance on Mobile
- [ ] Loads quickly on 4G connection
- [ ] Acceptable on 3G connection
- [ ] Smooth scrolling
- [ ] No lag on interactions
- [ ] Battery usage acceptable

---

## Test Execution Checklist

### Before Testing
- [ ] Latest code deployed
- [ ] Test environment configured
- [ ] Test data prepared
- [ ] Testing tools ready
- [ ] Bug tracking system ready

### During Testing
- [ ] Follow test cases systematically
- [ ] Document all findings
- [ ] Take screenshots/videos of bugs
- [ ] Note browser/device for each test
- [ ] Record reproduction steps

### After Testing
- [ ] All tests executed
- [ ] Results documented
- [ ] Bugs filed
- [ ] Test report created
- [ ] Stakeholders notified

---

## Regression Testing

After bug fixes or new features:
- [ ] Re-test affected areas
- [ ] Re-test related functionality
- [ ] Smoke test entire system
- [ ] Verify bug fixes
- [ ] Check for new issues

---

## Sign-Off Checklist

Before releasing to production:
- [ ] All critical tests pass
- [ ] All high-priority bugs fixed
- [ ] Known issues documented
- [ ] Performance acceptable
- [ ] Security review complete
- [ ] Accessibility review complete
- [ ] Cross-browser testing complete
- [ ] Mobile testing complete
- [ ] Stakeholder approval received
