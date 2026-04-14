import { useEffect, useRef, useState } from "react";
import { pdfjs } from "react-pdf";
import { IconLoader2 } from "@tabler/icons-react";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

type PDFDocumentProxy = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;

interface PdfPageRendererProps {
  url: string;
  className?: string;
}

/**
 * Renders a PDF inline using a native iframe with selectable text.
 * Calculates exact page dimensions via pdfjs so the iframe fits perfectly.
 */
export function PdfPageRenderer({ url, className }: PdfPageRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const container = containerRef.current;
      if (!container) return;

      try {
        setLoading(true);
        setError(null);

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch");
        if (cancelled) return;

        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;

        const data = new Uint8Array(arrayBuffer);

        // Measure page dimensions with pdfjs
        const pdfDoc: PDFDocumentProxy = await pdfjs.getDocument({
          data: data.slice(0),
          cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.296/cmaps/",
          cMapPacked: true,
        }).promise;

        if (cancelled) return;

        // Chrome PDF viewer with FitH: page fills width, so scale = containerWidth / pageWidth
        // The viewer adds ~3px margin top, ~3px bottom per page, ~5px gap between pages
        const containerWidth = container.clientWidth || 800;
        let totalPageHeight = 0;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          // With FitH, the page is scaled to fill the viewer width.
          // Chrome PDF viewer uses ~96% of iframe width for the page (4% for scrollbar/margin)
          const effectiveWidth = containerWidth * 0.98;
          const scale = effectiveWidth / vp.width;
          totalPageHeight += vp.height * scale;
        }

        // Chrome viewer spacing: ~8px top margin + 3px between pages + 3px bottom
        const viewerChrome = 8 + (pdfDoc.numPages - 1) * 5 + 3;

        if (cancelled) return;

        const blob = new Blob([data], { type: "application/pdf" });
        const objUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objUrl;

        setBlobUrl(objUrl);
        setIframeHeight(Math.ceil(totalPageHeight + viewerChrome));
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Erro ao carregar PDF");
          setLoading(false);
        }
      }
    };

    load();

    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ background: "white", overflow: "hidden", position: "relative" }}>
      {loading && (
        <div className="flex items-center justify-center py-12">
          <IconLoader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}
      {error && (
        <p className="text-center text-sm text-gray-500 py-8">{error}</p>
      )}
      {blobUrl && !loading && (
        <iframe
          src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&pagemode=none`}
          scrolling="no"
          style={{
            width: "calc(100% + 16px)",
            height: `${iframeHeight}px`,
            border: "none",
            display: "block",
            marginTop: "-8px",
            marginLeft: "-8px",
          }}
          title="PDF"
        />
      )}
    </div>
  );
}
