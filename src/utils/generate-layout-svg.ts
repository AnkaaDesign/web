/**
 * Generates an SVG string representing a layout with sections, doors, and dimensions.
 * Used in changelog displays to visualize layout changes.
 */
export const generateLayoutSVG = (layout: any): string => {
  if (!layout || !layout.layoutSections) return "";

  const height = (layout.height || 0) * 100; // Convert to cm
  const sections = layout.layoutSections || [];
  const totalWidth = sections.reduce(
    (sum: number, s: any) => sum + (s.width || 0) * 100,
    0,
  );
  const margin = 30;
  const extraSpace = 40;
  const svgWidth = totalWidth + margin * 2 + extraSpace;
  const svgHeight = height + margin * 2 + extraSpace;

  let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">`;

  // Main container
  svg += `<rect x="${margin}" y="${margin}" width="${totalWidth}" height="${height}" fill="none" stroke="#000" stroke-width="1"/>`;

  // Add section dividers
  let currentPos = 0;
  sections.forEach((section: any, index: number) => {
    const sectionWidth = (section.width || 0) * 100;

    if (index > 0) {
      const prevSection = sections[index - 1];
      if (!section.isDoor && !prevSection.isDoor) {
        const lineX = margin + currentPos;
        svg += `<line x1="${lineX}" y1="${margin}" x2="${lineX}" y2="${margin + height}" stroke="#333" stroke-width="0.5"/>`;
      }
    }

    currentPos += sectionWidth;
  });

  // Add doors from layoutSections
  currentPos = 0;
  sections.forEach((section: any) => {
    const sectionWidth = (section.width || 0) * 100;
    const sectionX = margin + currentPos;

    if (
      section.isDoor &&
      section.doorHeight !== null &&
      section.doorHeight !== undefined
    ) {
      const doorHeightCm = (section.doorHeight || 0) * 100;
      const doorTopY = margin + (height - doorHeightCm);

      // Door lines
      svg += `<line x1="${sectionX}" y1="${doorTopY}" x2="${sectionX}" y2="${margin + height}" stroke="#000" stroke-width="1"/>`;
      svg += `<line x1="${sectionX + sectionWidth}" y1="${doorTopY}" x2="${sectionX + sectionWidth}" y2="${margin + height}" stroke="#000" stroke-width="1"/>`;
      svg += `<line x1="${sectionX}" y1="${doorTopY}" x2="${sectionX + sectionWidth}" y2="${doorTopY}" stroke="#000" stroke-width="1"/>`;
    }

    currentPos += sectionWidth;
  });

  // Add width dimensions
  currentPos = 0;
  sections.forEach((section: any) => {
    const sectionWidth = (section.width || 0) * 100;
    const startX = margin + currentPos;
    const endX = margin + currentPos + sectionWidth;
    const centerX = startX + sectionWidth / 2;
    const dimY = margin + height + 15;

    svg += `<line x1="${startX}" y1="${dimY}" x2="${endX}" y2="${dimY}" stroke="#0066cc" stroke-width="1"/>`;
    svg += `<polygon points="${startX},${dimY} ${startX + 5},${dimY - 3} ${startX + 5},${dimY + 3}" fill="#0066cc"/>`;
    svg += `<polygon points="${endX},${dimY} ${endX - 5},${dimY - 3} ${endX - 5},${dimY + 3}" fill="#0066cc"/>`;
    svg += `<text x="${centerX}" y="${dimY + 12}" text-anchor="middle" font-size="10" fill="#0066cc">${Math.round(sectionWidth)}</text>`;

    currentPos += sectionWidth;
  });

  // Height dimension
  const dimX = margin - 15;
  svg += `<line x1="${dimX}" y1="${margin}" x2="${dimX}" y2="${margin + height}" stroke="#0066cc" stroke-width="1"/>`;
  svg += `<polygon points="${dimX},${margin} ${dimX - 3},${margin + 5} ${dimX + 3},${margin + 5}" fill="#0066cc"/>`;
  svg += `<polygon points="${dimX},${margin + height} ${dimX - 3},${margin + height - 5} ${dimX + 3},${margin + height - 5}" fill="#0066cc"/>`;
  svg += `<text x="${dimX - 8}" y="${margin + height / 2}" text-anchor="middle" font-size="10" fill="#0066cc" transform="rotate(-90, ${dimX - 8}, ${margin + height / 2})">${Math.round(height)}</text>`;
  svg += `</svg>`;

  return svg;
};
