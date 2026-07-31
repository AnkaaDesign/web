/**
 * Renderiza TODAS as páginas de um PDF empilhadas, direto na página.
 *
 * Substitui o `<iframe>`, que trazia a barra do visualizador do navegador, criava
 * um scroll interno e, no Safari iOS, não renderiza.
 *
 * Usa `<Page>` do react-pdf com `renderTextLayer` — e não um canvas desenhado à
 * mão. A primeira versão desenhava só o canvas, e o texto ficava **não
 * selecionável**: um canvas é bitmap, não tem texto. A camada de texto do pdf.js
 * é um overlay transparente posicionado sobre o bitmap, e é ela que permite
 * selecionar, copiar e usar Ctrl+F.
 */

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

import { VENDOR_ASSETS } from '@/config/assets';
pdfjs.GlobalWorkerOptions.workerSrc = VENDOR_ASSETS.pdfWorker;

export function InlineDocumentPages({
  url,
  width,
  className = "",
}: {
  url: string;
  width?: number;
  className?: string;
}) {
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState(false);

  return (
    <div className={className}>
      <Document
        file={url}
        onLoadSuccess={info => setNumPages(info.numPages)}
        onLoadError={() => setError(true)}
        loading={
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin" />
            Carregando documento…
          </div>
        }
        error={
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <IconAlertCircle className="h-4 w-4" />
            Não foi possível carregar o documento.
          </div>
        }
      >
        {/* Sem overflow próprio: a rolagem é a da página, e todas as folhas
            aparecem empilhadas de uma vez. */}
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            width={width}
            renderTextLayer
            renderAnnotationLayer={false}
            className={i < numPages - 1 ? "mb-3" : ""}
          />
        ))}
      </Document>
      {!error && numPages > 1 && (
        <p className="pt-2 text-center text-xs text-muted-foreground">{numPages} páginas</p>
      )}
    </div>
  );
}
