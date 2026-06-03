// Productivity statistics PDF — single-page A4 landscape with brand header,
// chart image rendered off-screen by ECharts (so the in-page dataZoom and the
// custom React legend don't leak into the export), summary stats, and the
// standard Ankaa Design footer used by the dossie/budget/payroll generators.

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { COMPANY_INFO, BRAND_COLORS } from '@/config/company';
import { formatDate } from '@/utils/date';

export interface ProductivityPdfOptions {
  /** Document title (top-right of header). */
  title: string;
  /** Centered subtitle drawn below the green divider. */
  subtitle: string;
  /** Filter chips joined with " • " under the subtitle. */
  filterLines: string[];
  /** Live ECharts option to render in print-friendly form. */
  chartOption: EChartsOption;
  /** Stats line drawn just above the footer. */
  summaryStats: Array<{ label: string; value: string }>;
  /** File-name suffix; the timestamp is appended automatically. */
  fileSuffix?: string;
}

// A4 landscape in points
const W = 841.89;
const H = 595.28;
const ML = 40;
const MR = 40;
const MT = 28;
const CW = W - ML - MR;

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

const GREEN = hexToRgb(BRAND_COLORS.primaryGreen);
const DARK = rgb(0.17, 0.17, 0.17);
const GRAY = rgb(0.4, 0.4, 0.4);

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array) {
  try { return await doc.embedPng(bytes); } catch {}
  try { return await doc.embedJpg(bytes); } catch {}
  return null;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Strip every interactive/print-unfriendly piece of the live option:
// - dataZoom (the slider is meaningless on paper)
// - any toolbox / brush
// Then upgrade text contrast and font sizes for print legibility,
// disable animations, force white background, and re-enable the native
// ECharts legend at the bottom because the React-side custom legend is
// part of the page DOM and does not appear in getDataURL output.
// Chart canvas is rendered at 1800px wide then embedded at ~760pt in the PDF
// (a 2.36× compression). To get readable text on paper, font sizes are bumped
// roughly proportional to that compression — e.g. fontSize 26 in the option
// shows up as ~11pt on the printed page, comparable to body copy.
function makePrintOption(opt: EChartsOption): EChartsOption {
  const upgradeXAxis = (a: any) => ({
    ...a,
    axisLabel: {
      ...(a?.axisLabel ?? {}),
      color: '#111827',
      fontSize: 22,
      fontWeight: 500,
      margin: 18,
    },
    axisLine: { show: true, lineStyle: { color: '#6b7280', width: 1.5 } },
    axisTick: { show: true, lineStyle: { color: '#6b7280', width: 1.5 } },
  });
  // yAxis: no split lines in print mode. Bar value labels already convey the
  // numbers, and the topmost split line was reading as a "duplicated" frame.
  // The axis line + ticks themselves stay visible, matching the x-axis.
  const upgradeYAxis = (a: any) => ({
    ...a,
    axisLabel: {
      ...(a?.axisLabel ?? {}),
      color: '#111827',
      fontSize: 22,
      fontWeight: 500,
      margin: 14,
    },
    axisLine: { show: true, lineStyle: { color: '#6b7280', width: 1.5 } },
    axisTick: { show: true, lineStyle: { color: '#6b7280', width: 1.5 } },
    splitLine: { show: false },
  });

  const xAxis = Array.isArray(opt.xAxis)
    ? opt.xAxis.map(upgradeXAxis)
    : opt.xAxis ? upgradeXAxis(opt.xAxis) : opt.xAxis;
  const yAxis = Array.isArray(opt.yAxis)
    ? opt.yAxis.map(upgradeYAxis)
    : opt.yAxis ? upgradeYAxis(opt.yAxis) : opt.yAxis;

  // Collect series names ECharts should expose in the legend (skip the
  // anonymous helper line series used by year-band / goal markArea).
  const series = Array.isArray(opt.series) ? opt.series : opt.series ? [opt.series] : [];
  const legendData: string[] = [];
  for (const s of series as any[]) {
    if (typeof s?.name === 'string' && !legendData.includes(s.name) && !s.silent) {
      legendData.push(s.name);
    }
  }
  // A legend with a single entry is noise (the title already says what the
  // bars are), so only show it when there are ≥2 series to disambiguate.
  const showLegend = legendData.length > 1;

  // Left/right gutters. ECharts' containLabel reserves space for the Y-axis
  // labels on the left and the X-axis label HEIGHT at the bottom, but it does
  // NOT account for the horizontal overhang of 45°-rotated category labels —
  // so the first/last (longest) labels get clipped at the canvas edge. Size
  // the gutter to the longest label when the X labels are rotated.
  const xAxisArr = Array.isArray(opt.xAxis) ? opt.xAxis : opt.xAxis ? [opt.xAxis] : [];
  let maxLabelLen = 0;
  let xRotated = false;
  for (const a of xAxisArr as any[]) {
    if (a?.axisLabel?.rotate) xRotated = true;
    for (const d of (a?.data ?? []) as any[]) {
      const s = d && typeof d === 'object' ? String(d.value ?? '') : String(d ?? '');
      if (s.length > maxLabelLen) maxLabelLen = s.length;
    }
  }
  // ~4.2px horizontal reach per character at the print font size (22px), with
  // a floor for normal charts and a cap so a single huge label can't eat the plot.
  const wideLabels = xRotated && maxLabelLen > 24;
  const sideGutter = wideLabels ? Math.min(240, Math.max(120, Math.round(maxLabelLen * 4.2))) : 70;
  const gridLeft = sideGutter;
  const gridRight = wideLabels ? Math.round(sideGutter * 0.72) : 50;
  const gridBottom = showLegend ? 120 : 70;

  return {
    ...opt,
    backgroundColor: '#ffffff',
    animation: false,
    dataZoom: [],
    legend: {
      show: showLegend,
      data: legendData,
      bottom: 14,
      itemWidth: 28,
      itemHeight: 18,
      itemGap: 36,
      textStyle: { color: '#111827', fontSize: 24, fontWeight: 600 },
    },
    grid: { left: gridLeft, right: gridRight, top: 44, bottom: gridBottom, containLabel: true },
    xAxis,
    yAxis,
    series: (series as any[]).map(s => ({
      ...s,
      label: s?.label && s.label.show
        ? { ...s.label, color: '#111827', fontSize: 24, fontWeight: 700 }
        : s?.label,
      tooltip: { show: false },
    })),
  };
}

// Canvas aspect ratio is tuned so the embedded image fills the full content
// width of the A4 page (CW ≈ 762pt) without being scaled down to fit the
// available height — otherwise it gets centered with large empty side margins.
async function renderChartToPng(
  option: EChartsOption,
  pxWidth = 2000,
  pxHeight = 780,
): Promise<Uint8Array> {
  const container = document.createElement('div');
  container.style.cssText =
    `position:absolute;left:-99999px;top:0;width:${pxWidth}px;height:${pxHeight}px;background:#ffffff;`;
  document.body.appendChild(container);
  try {
    const chart = echarts.init(container, undefined, {
      renderer: 'canvas',
      width: pxWidth,
      height: pxHeight,
    });
    chart.setOption(makePrintOption(option), { notMerge: true });
    // Give ECharts a tick to finish layout before snapshotting
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    await new Promise<void>(r => setTimeout(r, 50));
    const dataUrl = chart.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });
    chart.dispose();
    return dataUrlToBytes(dataUrl);
  } finally {
    container.remove();
  }
}

async function drawHeader(
  page: PDFPage,
  doc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  title: string,
): Promise<number> {
  let y = H - MT;

  // Logo (left)
  const logoBytes = await fetchImageBytes('/logo.png');
  if (logoBytes) {
    const logo = await embedImage(doc, logoBytes);
    if (logo) {
      const logoH = 34;
      const logoW = logoH * (logo.width / logo.height);
      page.drawImage(logo, { x: ML, y: y - logoH, width: logoW, height: logoH });
    }
  }

  // Title (right) — large + bold, matches the brand hierarchy.
  const titleSize = 18;
  const titleW = fontBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, { x: W - MR - titleW, y: y - 14, size: titleSize, font: fontBold, color: DARK });

  const now = new Date();
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateText = `Gerado em ${formatDate(now)} às ${time}`;
  const dateSize = 9;
  const dateW = font.widthOfTextAtSize(dateText, dateSize);
  page.drawText(dateText, { x: W - MR - dateW, y: y - 28, size: dateSize, font, color: GRAY });

  y -= 44;
  page.drawRectangle({ x: ML, y, width: CW, height: 1, color: GREEN });
  y -= 16;
  return y;
}

function formatPhoneWithDDD(phone: string): string {
  if (!phone) return '';
  if (phone.startsWith('(')) return phone;
  const m = phone.match(/^(\d{2})\s+(.+)$/);
  return m ? `(${m[1]}) ${m[2]}` : phone;
}

function ensureWww(host: string): string {
  if (!host) return host;
  return host.startsWith('www.') ? host : `www.${host}`;
}

// Footer block is anchored to absolute y values from the page bottom so the
// chart layout can reliably leave room above it. Rows are stacked vertically:
// name → address → website (with www.) → phone, mirroring the other branded
// PDF generators in the codebase.
const FOOTER_LINE_Y = 86;
const FOOTER_BLOCK_TOP = 96;

function drawFooter(page: PDFPage, font: PDFFont, fontBold: PDFFont) {
  const lineY = FOOTER_LINE_Y;
  page.drawRectangle({ x: ML, y: lineY, width: CW, height: 1, color: GREEN });

  // Row 1: company name (bold green)
  page.drawText(COMPANY_INFO.name, { x: ML, y: lineY - 14, size: 11, font: fontBold, color: GREEN });

  // Row 2: address (gray)
  page.drawText(COMPANY_INFO.address, { x: ML, y: lineY - 28, size: 8.5, font, color: GRAY });

  // Row 3: website (green) with www. prefix, ABOVE phone
  const bareSite = (COMPANY_INFO.website || '').replace(/^https?:\/\//i, '');
  page.drawText(ensureWww(bareSite), { x: ML, y: lineY - 42, size: 8.5, font, color: GREEN });

  // Row 4: phone (green)
  const phoneFmt = formatPhoneWithDDD(COMPANY_INFO.phone);
  page.drawText(phoneFmt, { x: ML, y: lineY - 56, size: 8.5, font, color: GREEN });
}

export async function exportProductivityPdf(opts: ProductivityPdfOptions): Promise<void> {
  // 1. Snapshot the chart off-screen, in print-friendly form.
  const chartBytes = await renderChartToPng(opts.chartOption);

  // 2. Build the document.
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([W, H]);

  let y = await drawHeader(page, doc, font, fontBold, opts.title);

  // Subtitle (centered, ~14pt). Sits visibly below the green header line.
  if (opts.subtitle) {
    const size = 13;
    const w = fontBold.widthOfTextAtSize(opts.subtitle, size);
    page.drawText(opts.subtitle, { x: (W - w) / 2, y: y - 14, size, font: fontBold, color: DARK });
    y -= 26;
  }

  // Filter chips — context underneath the subtitle.
  if (opts.filterLines.length) {
    const filterText = opts.filterLines.join('   •   ');
    const size = 9.5;
    const w = font.widthOfTextAtSize(filterText, size);
    page.drawText(filterText, { x: (W - w) / 2, y: y - 4, size, font, color: GRAY });
    y -= 18;
  }

  // Summary stats — boxed pill above the chart so the headline numbers read
  // first. A light fill + green accent line gives it a "key metrics" feel
  // without overpowering the chart.
  if (opts.summaryStats.length) {
    const statsText = opts.summaryStats
      .map(s => `${s.label}: ${s.value}`)
      .join('      |      ');
    // Shrink the font so the (possibly long) metrics line stays on one row
    // inside the page margins.
    let size = 11;
    const minSize = 7;
    while (size > minSize && fontBold.widthOfTextAtSize(statsText, size) + 36 > CW) {
      size -= 0.5;
    }
    const statsW = fontBold.widthOfTextAtSize(statsText, size);
    const padX = 18;
    const padY = 9;
    const boxW = statsW + padX * 2;
    const boxH = size + padY * 2;
    const boxX = (W - boxW) / 2;
    const boxY = y - 8 - boxH;
    page.drawRectangle({
      x: boxX, y: boxY, width: boxW, height: boxH,
      color: rgb(0.96, 0.97, 0.96),
      borderColor: GREEN,
      borderWidth: 0.6,
    });
    page.drawText(statsText, {
      x: boxX + padX,
      y: boxY + padY + 1,
      size,
      font: fontBold,
      color: DARK,
    });
    y = boxY - 14;
  }

  // Chart image fills the remaining vertical space above the footer block.
  const chartImg = await doc.embedPng(chartBytes);
  const chartTop = y;
  const chartBottom = FOOTER_BLOCK_TOP;
  const availableH = chartTop - chartBottom;
  const ratio = chartImg.height / chartImg.width;
  let chartW = CW;
  let chartH = chartW * ratio;
  if (chartH > availableH) {
    chartH = availableH;
    chartW = chartH / ratio;
  }
  const chartX = ML + (CW - chartW) / 2;
  const chartYpos = chartBottom + (availableH - chartH) / 2;
  page.drawImage(chartImg, { x: chartX, y: chartYpos, width: chartW, height: chartH });

  drawFooter(page, font, fontBold);

  // 3. Save and trigger download.
  const pdfBytes = await doc.save();
  // Cast to BlobPart to satisfy TS lib.dom that may otherwise widen the
  // backing buffer to `ArrayBufferLike` (which can include SharedArrayBuffer).
  const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const ts = new Date();
  const stamp = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}-${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`;
  link.href = url;
  link.download = `${opts.fileSuffix ?? 'produtividade'}-${stamp}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
