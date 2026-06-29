import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTheme } from "@/contexts/theme-context";
import { useLayoutsByTruck } from "@/hooks";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/utils/file";
import {
  IconPhoto,
  IconRuler,
  IconDownload,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from "@tabler/icons-react";

// Component to display truck layout SVG preview
const TruckLayoutPreview = ({ truckId, taskName }: { truckId: string; taskName?: string }) => {
  const { data: layouts } = useLayoutsByTruck(truckId, { includePhoto: true });
  const [selectedSide, setSelectedSide] = useState<'left' | 'right' | 'back'>('left');

  // Theme detection for SVG colors (matching mobile version)
  const { theme } = useTheme();
  const isDark = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme === 'dark';
  }, [theme]);

  // Theme-aware SVG colors matching mobile version
  const svgColors = useMemo(() => ({
    stroke: isDark ? '#e5e5e5' : '#171717',
    divider: isDark ? '#a3a3a3' : '#525252',
    dimension: isDark ? '#60a5fa' : '#0066cc',
  }), [isDark]);

  // Zoom state
  const [zoomScale, setZoomScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, translateX: 0, translateY: 0 });
  const zoomContainerRef = useRef<HTMLDivElement>(null);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  // Zoom control functions
  const handleZoomIn = useCallback(() => {
    setZoomScale(prev => Math.min(prev + 0.5, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomScale(prev => Math.max(prev - 0.5, MIN_SCALE));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  // Mouse wheel zoom handler - uses native event to properly prevent scroll
  const handleWheelZoom = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.25 : 0.25; // Fast zoom
    setZoomScale(prev => Math.min(Math.max(prev + delta, MIN_SCALE), MAX_SCALE));
  }, []);

  // Attach wheel event listener with passive: false to prevent page scroll
  // Note: We depend on `layouts` because the container ref isn't available until layouts load
  // (component returns null while loading, so the ref doesn't exist yet)
  useEffect(() => {
    const container = zoomContainerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelZoom);
    };
  }, [handleWheelZoom, layouts]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      translateX,
      translateY,
    };
  }, [translateX, translateY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setTranslateX(dragStartRef.current.translateX + deltaX);
    setTranslateY(dragStartRef.current.translateY + deltaY);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Reset zoom when side changes - need to use useEffect but component can return early
  // So we'll handle this in the side button click handlers instead

  if (!layouts) return null;

  const hasLayouts = layouts.leftSideLayout || layouts.rightSideLayout || layouts.backSideLayout;
  if (!hasLayouts) return null;

  // Get current layout
  const currentLayout = selectedSide === 'left' ? layouts.leftSideLayout :
                       selectedSide === 'right' ? layouts.rightSideLayout :
                       layouts.backSideLayout;

  if (!currentLayout) return null;

  // Generate SVG preview - uses theme colors for display, black for export
  const generatePreviewSVG = (layout: any, side: string, forExport: boolean = false) => {
    const getSideLabel = (s: string) => {
      switch (s) {
        case 'left': return 'Motorista';
        case 'right': return 'Sapo';
        case 'back': return 'Traseira';
        default: return s;
      }
    };

    // Use theme colors for display, black for export
    const colors = forExport ? {
      stroke: '#000000',
      divider: '#333333',
      dimension: '#0066cc',
    } : svgColors;

    const height = layout.height * 100;
    const sections = layout.layoutSections;
    const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);

    // For export: use cm values as mm (no scaling - 840cm becomes 840mm in SVG)
    const margin = forExport ? 50 : 50;
    const extraSpace = forExport ? 100 : 50;
    const scaleFactor = 1; // No scaling - cm values used directly as mm
    const strokeWidth = forExport ? 1 : 1;
    const fontSize = forExport ? 12 : 12;
    const arrowSize = forExport ? 5 : 5;

    const scaledWidth = totalWidth * scaleFactor;
    const scaledHeight = height * scaleFactor;
    const svgWidth = scaledWidth + margin * 2 + extraSpace;
    const svgHeight = scaledHeight + margin * 2 + extraSpace;

    let svg = forExport
      ? `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}mm" height="${svgHeight}mm" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <text x="${margin}" y="25" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.stroke}">${getSideLabel(side)}</text>`
      : `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`;

    svg += `
  <rect x="${margin}" y="${margin}" width="${scaledWidth}" height="${scaledHeight}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>`;

    // Section dividers using path
    let currentPos = 0;
    sections.forEach((section: any, index: number) => {
      const sectionWidth = section.width * 100 * scaleFactor;
      if (index > 0) {
        const prevSection = sections[index - 1];
        if (!section.isDoor && !prevSection.isDoor) {
          const lineX = margin + currentPos;
          svg += `
  <path d="M${lineX},${margin} L${lineX},${margin + scaledHeight}" fill="none" stroke="${colors.divider}" stroke-width="${strokeWidth * 0.5}"/>`;
        }
      }
      currentPos += sectionWidth;
    });

    // Doors using path
    if (layout.doors && layout.doors.length > 0) {
      layout.doors.forEach((door: any) => {
        const doorX = margin + (door.position || 0) * 100 * scaleFactor;
        const doorWidth = (door.width || 0) * 100 * scaleFactor;
        const doorOffsetTop = (door.offsetTop || door.topOffset || 0) * 100 * scaleFactor;
        const doorY = margin + doorOffsetTop;
        const doorBottomY = margin + scaledHeight;
        svg += `
  <path d="M${doorX},${doorY} L${doorX},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${doorX + doorWidth},${doorY} L${doorX + doorWidth},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${doorX},${doorY} L${doorX + doorWidth},${doorY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>`;
      });
    } else if (layout.layoutSections) {
      let currentPos = 0;
      layout.layoutSections.forEach((section: any) => {
        const sectionWidth = section.width * 100 * scaleFactor;
        const sectionX = margin + currentPos;
        if (section.isDoor && section.doorHeight !== null && section.doorHeight !== undefined) {
          const doorHeightCm = section.doorHeight * 100 * scaleFactor;
          const doorTopY = margin + (scaledHeight - doorHeightCm);
          const doorBottomY = margin + scaledHeight;
          svg += `
  <path d="M${sectionX},${doorTopY} L${sectionX},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${sectionX + sectionWidth},${doorTopY} L${sectionX + sectionWidth},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${sectionX},${doorTopY} L${sectionX + sectionWidth},${doorTopY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>`;
        }
        currentPos += sectionWidth;
      });
    }

    // Width dimensions using path
    currentPos = 0;
    sections.forEach((section: any) => {
      const sectionWidth = section.width * 100 * scaleFactor;
      const startX = margin + currentPos;
      const endX = margin + currentPos + sectionWidth;
      const centerX = startX + sectionWidth / 2;
      const dimY = margin + scaledHeight + 20;
      svg += `
  <path d="M${startX},${dimY} L${endX},${dimY}" fill="none" stroke="${colors.dimension}" stroke-width="${strokeWidth}"/>
  <path d="M${startX},${dimY} L${startX + arrowSize},${dimY - arrowSize * 0.6} L${startX + arrowSize},${dimY + arrowSize * 0.6} Z" fill="${colors.dimension}" stroke="none"/>
  <path d="M${endX},${dimY} L${endX - arrowSize},${dimY - arrowSize * 0.6} L${endX - arrowSize},${dimY + arrowSize * 0.6} Z" fill="${colors.dimension}" stroke="none"/>
  <text x="${centerX}" y="${dimY + fontSize * 1.25}" font-family="Arial, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${colors.dimension}">${Math.round(section.width * 100)}</text>`;
      currentPos += sectionWidth;
    });

    // Height dimension using path (no transform)
    const dimX = margin - 20;
    svg += `
  <path d="M${dimX},${margin} L${dimX},${margin + scaledHeight}" fill="none" stroke="${colors.dimension}" stroke-width="${strokeWidth}"/>
  <path d="M${dimX},${margin} L${dimX - arrowSize * 0.6},${margin + arrowSize} L${dimX + arrowSize * 0.6},${margin + arrowSize} Z" fill="${colors.dimension}" stroke="none"/>
  <path d="M${dimX},${margin + scaledHeight} L${dimX - arrowSize * 0.6},${margin + scaledHeight - arrowSize} L${dimX + arrowSize * 0.6},${margin + scaledHeight - arrowSize} Z" fill="${colors.dimension}" stroke="none"/>
  <text x="${dimX - fontSize * 1.25}" y="${margin + scaledHeight / 2 + 4}" font-family="Arial, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${colors.dimension}" writing-mode="tb">${Math.round(height)}</text>
</svg>`;

    return svg;
  };

  // Generate a single SVG element for one layout (used in combined SVG for export)
  // Uses <path> instead of <line> and avoids transforms to prevent CorelDRAW locking
  // All values use cm values as mm (no scaling - 840cm becomes 840mm)
  const generateLayoutElement = (layout: any, side: string, offsetX: number, offsetY: number) => {
    const getSideLabel = (s: string) => {
      switch (s) {
        case 'left': return 'Motorista';
        case 'right': return 'Sapo';
        case 'back': return 'Traseira';
        default: return s;
      }
    };

    // Export uses cm values as mm (no scaling)
    const height = layout.height * 100;
    const sections = layout.layoutSections;
    const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
    const margin = 50; // 50mm margin
    const strokeWidth = 1;
    const fontSize = 12;
    const arrowSize = 5;

    const ox = offsetX;
    const oy = offsetY;

    // Export colors - always black
    const colors = {
      stroke: '#000000',
      divider: '#333333',
      dimension: '#0066cc',
    };

    let svg = `
  <text x="${ox + margin}" y="${oy + 25}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${colors.stroke}">${getSideLabel(side)}</text>
  <rect x="${ox + margin}" y="${oy + margin}" width="${totalWidth}" height="${height}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>`;

    // Add section dividers using path
    let currentPos = 0;
    sections.forEach((section: any, index: number) => {
      const sectionWidth = section.width * 100;
      if (index > 0) {
        const prevSection = sections[index - 1];
        if (!section.isDoor && !prevSection.isDoor) {
          const lineX = ox + margin + currentPos;
          svg += `
  <path d="M${lineX},${oy + margin} L${lineX},${oy + margin + height}" fill="none" stroke="${colors.divider}" stroke-width="${strokeWidth * 0.5}"/>`;
        }
      }
      currentPos += sectionWidth;
    });

    // Add doors using path
    currentPos = 0;
    sections.forEach((section: any) => {
      const sectionWidth = section.width * 100;
      const sectionX = ox + margin + currentPos;
      if (section.isDoor && section.doorHeight !== null && section.doorHeight !== undefined) {
        const doorHeightMm = section.doorHeight * 100;
        const doorTopY = oy + margin + (height - doorHeightMm);
        const doorBottomY = oy + margin + height;
        svg += `
  <path d="M${sectionX},${doorTopY} L${sectionX},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${sectionX + sectionWidth},${doorTopY} L${sectionX + sectionWidth},${doorBottomY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>
  <path d="M${sectionX},${doorTopY} L${sectionX + sectionWidth},${doorTopY}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeWidth}"/>`;
      }
      currentPos += sectionWidth;
    });

    // Add width dimensions using path (labels show cm values)
    currentPos = 0;
    sections.forEach((section: any) => {
      const sectionWidthMm = section.width * 100;
      const startX = ox + margin + currentPos;
      const endX = ox + margin + currentPos + sectionWidthMm;
      const centerX = startX + sectionWidthMm / 2;
      const dimY = oy + margin + height + 20;
      svg += `
  <path d="M${startX},${dimY} L${endX},${dimY}" fill="none" stroke="${colors.dimension}" stroke-width="${strokeWidth}"/>
  <path d="M${startX},${dimY} L${startX + arrowSize},${dimY - arrowSize * 0.6} L${startX + arrowSize},${dimY + arrowSize * 0.6} Z" fill="${colors.dimension}" stroke="none"/>
  <path d="M${endX},${dimY} L${endX - arrowSize},${dimY - arrowSize * 0.6} L${endX - arrowSize},${dimY + arrowSize * 0.6} Z" fill="${colors.dimension}" stroke="none"/>
  <text x="${centerX}" y="${dimY + fontSize * 1.25}" font-family="Arial, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${colors.dimension}">${Math.round(section.width * 100)}</text>`;
      currentPos += sectionWidthMm;
    });

    // Height dimension using path (label shows cm value)
    const dimX = ox + margin - 20;
    const dimTopY = oy + margin;
    const dimBottomY = oy + margin + height;
    svg += `
  <path d="M${dimX},${dimTopY} L${dimX},${dimBottomY}" fill="none" stroke="${colors.dimension}" stroke-width="${strokeWidth}"/>
  <path d="M${dimX},${dimTopY} L${dimX - arrowSize * 0.6},${dimTopY + arrowSize} L${dimX + arrowSize * 0.6},${dimTopY + arrowSize} Z" fill="${colors.dimension}" stroke="none"/>
  <path d="M${dimX},${dimBottomY} L${dimX - arrowSize * 0.6},${dimBottomY - arrowSize} L${dimX + arrowSize * 0.6},${dimBottomY - arrowSize} Z" fill="${colors.dimension}" stroke="none"/>
  <text x="${dimX - fontSize * 1.25}" y="${oy + margin + height / 2 + 4}" font-family="Arial, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${colors.dimension}" writing-mode="tb">${Math.round(layout.height * 100)}</text>`;

    return svg;
  };

  // Calculate dimensions for a layout element (in mm for export)
  // Uses cm values as mm (no scaling - 840cm becomes 840mm)
  const getLayoutDimensions = (layout: any) => {
    const height = layout.height * 100;
    const sections = layout.layoutSections;
    const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
    const margin = 50; // 50mm margin
    const extraSpace = 50; // Space for dimensions
    return {
      width: totalWidth + margin * 2 + extraSpace,
      height: height + margin * 2 + extraSpace
    };
  };

  // Generate combined SVG with all layouts (uses cm values as mm)
  const generateCombinedSVG = () => {
    const gap = 50; // 50mm gap between layouts
    const margin = 30; // 30mm overall margin

    // Calculate dimensions for each layout
    const leftDims = layouts.leftSideLayout ? getLayoutDimensions(layouts.leftSideLayout) : null;
    const rightDims = layouts.rightSideLayout ? getLayoutDimensions(layouts.rightSideLayout) : null;
    const backDims = layouts.backSideLayout ? getLayoutDimensions(layouts.backSideLayout) : null;

    // Calculate total SVG dimensions
    // Left column: Motorista on top, Sapo below
    const leftColumnWidth = Math.max(leftDims?.width || 0, rightDims?.width || 0);
    const leftColumnHeight = (leftDims?.height || 0) + (rightDims ? gap + (rightDims?.height || 0) : 0);

    // Right column: Traseira aligned with top
    const rightColumnWidth = backDims?.width || 0;
    const rightColumnHeight = backDims?.height || 0;

    const totalWidth = margin * 2 + leftColumnWidth + (backDims ? gap + rightColumnWidth : 0);
    const totalHeight = margin * 2 + Math.max(leftColumnHeight, rightColumnHeight);

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${totalWidth}mm" height="${totalHeight}mm" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">`;

    // Add Motorista (left side) at top-left
    if (layouts.leftSideLayout) {
      svg += generateLayoutElement(layouts.leftSideLayout, 'left', margin, margin);
    }

    // Add Sapo (right side) below Motorista, left-aligned
    if (layouts.rightSideLayout) {
      const offsetY = margin + (leftDims?.height || 0) + gap;
      svg += generateLayoutElement(layouts.rightSideLayout, 'right', margin, offsetY);
    }

    // Add Traseira (back side) next to Motorista, top-aligned
    if (layouts.backSideLayout) {
      const offsetX = margin + leftColumnWidth + gap;
      svg += generateLayoutElement(layouts.backSideLayout, 'back', offsetX, margin);
    }

    svg += `
</svg>`;

    return svg;
  };

  const downloadSVG = () => {
    if (!currentLayout) return;

    const svgContent = generatePreviewSVG(currentLayout, selectedSide, true); // forExport = true
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const getSideLabel = (s: string) => {
      switch (s) {
        case 'left': return 'motorista';
        case 'right': return 'sapo';
        case 'back': return 'traseira';
        default: return s;
      }
    };

    const taskPrefix = taskName ? `${taskName}-` : '';
    const sections = currentLayout.layoutSections;
    const totalWidth = sections.reduce((sum: number, s: any) => sum + s.width * 100, 0);
    // Filename shows mm (cm values used directly as mm)
    link.download = `${taskPrefix}layout-${getSideLabel(selectedSide)}-${Math.round(totalWidth)}mm.svg`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Calculate dimensions from current layout
  const getDimensions = () => {
    if (currentLayout?.height && currentLayout?.layoutSections?.length > 0) {
      const totalWidth = currentLayout.layoutSections.reduce((sum: number, section: any) => sum + (section.width || 0), 0);
      return { width: totalWidth, height: currentLayout.height };
    }
    return null;
  };
  const dimensions = getDimensions();

  return (
    <div className="space-y-3">
      {/* Side selector + download buttons share one row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={selectedSide === 'left' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSelectedSide('left'); handleResetZoom(); }}
            disabled={!layouts.leftSideLayout}
          >
            Motorista
          </Button>
          <Button
            type="button"
            variant={selectedSide === 'right' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSelectedSide('right'); handleResetZoom(); }}
            disabled={!layouts.rightSideLayout}
          >
            Sapo
          </Button>
          <Button
            type="button"
            variant={selectedSide === 'back' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSelectedSide('back'); handleResetZoom(); }}
            disabled={!layouts.backSideLayout}
            className="gap-1"
          >
            Traseira
            {(layouts.backSideLayout as any)?.photo && (
              <IconPhoto className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              const apiUrl = getApiBaseUrl();
              const taskPrefix = taskName ? `${taskName}-` : '';
              const combinedSvgContent = generateCombinedSVG();
              const hasBacksidePhoto = layouts.backSideLayout?.photo;
              if (hasBacksidePhoto) {
                const JSZip = (await import('jszip')).default;
                const zip = new JSZip();
                zip.file(`${taskPrefix}layouts.svg`, combinedSvgContent);
                try {
                  if (layouts.backSideLayout?.photo?.id) {
                    const photoUrl = `${apiUrl}/files/${layouts.backSideLayout.photo.id}/download`;
                    const response = await fetch(photoUrl);
                    if (response.ok) {
                      const blob = await response.blob();
                      const extension = layouts.backSideLayout.photo.mimeType?.split('/')[1] || 'jpg';
                      zip.file(`${taskPrefix}layout-traseira-foto.${extension}`, blob);
                    }
                  }
                } catch (error) {
                  console.error('Error downloading backside photo:', error);
                }
                const content = await zip.generateAsync({ type: 'blob' });
                const url = URL.createObjectURL(content);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${taskPrefix}layouts.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              } else {
                const blob = new Blob([combinedSvgContent], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${taskPrefix}layouts.svg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }
            }}
            size="sm"
            variant="default"
          >
            <IconDownload className="h-4 w-4 mr-1" />
            Baixar Tudo
          </Button>
          <Button onClick={downloadSVG} size="sm" variant="outline">
            <IconDownload className="h-4 w-4 mr-1" />
            Baixar Layout
          </Button>
          {currentLayout?.photo && (
            <Button
              onClick={() => {
                const apiUrl = getApiBaseUrl();
                const photoUrl = `${apiUrl}/files/${currentLayout.photo.id}/download`;
                window.open(photoUrl, '_blank');
              }}
              size="sm"
              variant="outline"
            >
              <IconDownload className="h-4 w-4 mr-1" />
              Baixar Foto
            </Button>
          )}
        </div>
      </div>

      {/* SVG Preview with Zoom Controls — measures live in the zoom bar; height kept compact */}
      {currentLayout && (
        <div className="border border-border rounded-lg bg-background/50 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-1 border-b border-border/30 p-2">
            {dimensions ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <IconRuler className="h-3.5 w-3.5" />
                Medidas: <span className="font-medium text-foreground">{Math.round(dimensions.width * 100)} x {Math.round(dimensions.height * 100)} cm</span>
              </span>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-1">
              <span className="mr-2 text-xs text-muted-foreground">{Math.round(zoomScale * 100)}%</span>
              <Button type="button" variant="ghost" size="sm" onClick={handleZoomOut} disabled={zoomScale <= MIN_SCALE} className="h-8 w-8 p-0">
                <IconZoomOut size={18} />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleResetZoom} className="h-8 w-8 p-0">
                <IconZoomReset size={18} />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleZoomIn} disabled={zoomScale >= MAX_SCALE} className="h-8 w-8 p-0">
                <IconZoomIn size={18} />
              </Button>
            </div>
          </div>
          <div
            ref={zoomContainerRef}
            className="cursor-grab select-none overflow-hidden active:cursor-grabbing"
            style={{ minHeight: '200px' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="flex min-h-[200px] items-center justify-center p-6"
              style={{
                transform: `scale(${zoomScale}) translate(${translateX / zoomScale}px, ${translateY / zoomScale}px)`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              }}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: generatePreviewSVG(currentLayout, selectedSide, false),
                }}
                className="w-full max-w-full [&>svg]:mx-auto [&>svg]:block [&>svg]:h-auto [&>svg]:max-h-[260px] [&>svg]:w-auto [&>svg]:max-w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Bare-body section for the generic DetailPage: renders the truck "Medidas do Caminhão"
 * SVG layout preview (side selector, zoom controls, download buttons). The host provides
 * the Card chrome + the "Medidas do Caminhão" title, so this returns no outer Card.
 */
export function TruckLayoutSection({ truckId, taskName }: { truckId: string; taskName?: string }): React.ReactNode {
  return <TruckLayoutPreview truckId={truckId} taskName={taskName} />;
}
