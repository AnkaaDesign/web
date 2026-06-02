import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { IconLoader2, IconFileText } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

// A4 aspect ratio (width / height) in points.
const A4_RATIO = 595.28 / 841.89;

interface CertificatePdfPreviewProps {
  /** Remote PDF URL (public page / stored file). */
  url?: string;
  /** In-memory PDF bytes (live tool preview). */
  data?: Uint8Array;
  className?: string;
}

/**
 * Renders a single-page PDF to a canvas (via react-pdf), scaled to fit the
 * available container height with no scrolling and no viewer chrome/border.
 * Used for both the certificate tool preview and the public page.
 */
export function CertificatePdfPreview({ url, data, className }: CertificatePdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const file = useMemo(() => {
    if (data) return { data };
    if (url) return url;
    return null;
  }, [data, url]);

  useEffect(() => {
    setError(false);
  }, [file]);

  // Fit the A4 page into the box by height, then clamp by width.
  let pageHeight = box.h;
  if (pageHeight * A4_RATIO > box.w) {
    pageHeight = box.w / A4_RATIO;
  }
  pageHeight = Math.max(0, Math.floor(pageHeight));

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {error ? (
        <div className="flex flex-col items-center text-muted-foreground text-sm">
          <IconFileText className="h-8 w-8 mb-2 opacity-50" />
          Não foi possível carregar o PDF.
        </div>
      ) : file && box.h > 0 && pageHeight > 0 ? (
        <Document
          file={file}
          loading={<IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          error={
            <div className="flex flex-col items-center text-muted-foreground text-sm">
              <IconFileText className="h-8 w-8 mb-2 opacity-50" />
              Não foi possível carregar o PDF.
            </div>
          }
          onLoadError={() => setError(true)}
        >
          <Page
            pageNumber={1}
            height={pageHeight}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading=""
            className="shadow-md [&>canvas]:!rounded-sm"
          />
        </Document>
      ) : (
        <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

export default CertificatePdfPreview;
