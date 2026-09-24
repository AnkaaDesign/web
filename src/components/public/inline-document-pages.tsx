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

/**
 * Pixels de canvas por folha no modo `sharpZoom` — a largura do bitmap, não a
 * da tela.
 *
 * No celular a folha ocupa ~360px de CSS, e o pdf.js desenha o bitmap na
 * densidade da tela (2–3×): legível parado, mas a pinça do navegador amplia um
 * bitmap de ~1000px e o texto de 7pt vira borrão. Desenhar a ~1600px de largura
 * deixa ampliar 2× com nitidez. O teto de 4× segura a memória: uma A4 a 1600px
 * são ~3,6 Mpx de canvas por folha, longe do limite de 16,7 Mpx do Safari iOS —
 * e o WebView do WhatsApp é justamente onde a memória é mais curta.
 */
const PAGE_PIXELS = 1600;

function sharpRatio(width: number | undefined): number | undefined {
  if (typeof window === "undefined" || !width) return undefined;
  const native = window.devicePixelRatio || 1;
  return Math.min(4, Math.max(native, PAGE_PIXELS / width));
}

export function InlineDocumentPages({
  url,
  width,
  className = "",
  sharpZoom = false,
}: {
  url: string;
  width?: number;
  className?: string;
  /** Desenha o bitmap em alta resolução para a pinça ampliar sem borrar. */
  sharpZoom?: boolean;
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
            devicePixelRatio={sharpZoom ? sharpRatio(width) : undefined}
            // `overflow-hidden` + sombra: a camada de texto do pdf.js tem spans
            // que passam da borda da folha em alguns navegadores embutidos, e
            // eram eles — não o documento — que criavam rolagem lateral. A
            // sombra separa uma folha da outra no fundo branco do cartão.
            className={`overflow-hidden shadow-sm ring-1 ring-border ${i < numPages - 1 ? "mb-3" : ""}`}
          />
        ))}
      </Document>
      {!error && numPages > 1 && (
        <p className="pt-2 text-center text-xs text-muted-foreground">{numPages} páginas</p>
      )}
    </div>
  );
}
