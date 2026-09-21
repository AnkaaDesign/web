// web/src/components/cliente/assinatura-documento.tsx
//
// O DOCUMENTO — dentro da sessão do portal.
//
// A cerimônia pública (`pages/public/signature/[token].tsx`) passa a URL do PDF
// direto para o `<Document>` do react-pdf: lá a rota é autenticada pelo TOKEN
// que está no próprio caminho, então uma busca sem cabeçalho funciona.
//
// Aqui não funciona, por dois motivos somados:
//
//   1. a rota do portal é `@ResponsibleOnly()` — o bearer mora no cabeçalho
//      `Authorization`, e navegação de topo (`<a href>`, `<iframe>`,
//      `window.open`) não leva cabeçalho nenhum: dá 401;
//   2. o helmet global manda `X-Frame-Options: DENY`, então embutir por
//      `<iframe>` estava fora de questão de qualquer forma.
//
// A saída é a mesma de `signatureService.openInternalDocument`: buscar os BYTES
// pelo cliente HTTP (que injeta o token), montar um `blob:` e entregar esse
// endereço ao visualizador. `blob:` é same-origin em relação à página, vale
// igual em produção (onde web e api são domínios distintos) e nunca deixa o PDF
// numa URL que possa vazar em histórico ou `Referer`.
//
// ⛔ POR QUE NÃO SE USA A ROTA PÚBLICA DO ORÇAMENTO
//
// `signatureService.quoteDocumentUrl(budgetId)` existe, é pública (a capability
// é o UUID do orçamento) e serviria sem cabeçalho nenhum. Serviria o documento
// COMPLETO — e o signatário do portal pode ter RECORTE
// (`PortalPendingSignature.sections`). Entregar o documento inteiro a quem
// recebeu um recorte sem `PRICING` mostraria o preço que a emissão decidiu não
// lhe mostrar. É a mesma classe de vazamento que `GET /budgets/public/:id` tem
// hoje, e não se repete aqui.
//
// ⚠️ ROTA QUE FALTA NO §4 DO CONTRATO — relatado.
// `GET /cliente/me/assinaturas/:signerId/documento.pdf` é a irmã natural das
// duas rotas de assinatura, e não está no contrato. `api-client/portal.ts` é de
// outro pacote e não pode ser editado daqui, então a chamada sai da instância
// compartilhada, que é a MESMA que aquele módulo estende (interceptor de
// `_statusCode` e de toast incluídos). Quando a rota entrar no contrato, isto
// vira `portalService.getSignatureDocument(signerId)` e este arquivo perde as
// três linhas de HTTP.
import { useEffect, useRef, useState } from "react";
import type { AxiosRequestConfig } from "axios";
import { IconAlertCircle, IconExternalLink, IconLoader2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { InlineDocumentPages } from "@/components/public/inline-document-pages";
import { portalErrorMessage } from "@/api-client/portal";
import { responsibleAuthClient } from "@/api-client/responsible-auth";

export interface AssinaturaDocumentoProps {
  signerId: string;
  /**
   * Muda quando o ATO acontece.
   *
   * O PDF é remontado a cada pedido — os selos de quem já assinou são
   * carimbados na hora —, então um endereço constante deixaria a folha
   * mostrando a linha em branco depois de assinada, até um F5 manual. A
   * cerimônia pública resolve isso amarrando a URL ao estado do signatário;
   * aqui, como os bytes são buscados por nós, a versão é a dependência do
   * efeito.
   */
  version?: string;
}

/**
 * `metadata.suppressToast` é a convenção que o interceptor de
 * `api-client/portal.ts` lê, e não existe no tipo do axios — daí a interseção.
 */
type PortalBlobRequestConfig = AxiosRequestConfig & {
  metadata?: { suppressToast?: boolean };
};

async function fetchDocumento(signerId: string): Promise<Blob> {
  const config: PortalBlobRequestConfig = {
    responseType: "blob",
    // A tela é dona da própria mensagem: o quadro abaixo já diz que o documento
    // não abriu, e um toast vermelho por cima seria a mesma frase duas vezes —
    // ainda por cima numa tela em que ele competiria com o botão de assinar.
    metadata: { suppressToast: true },
  };
  const response = await responsibleAuthClient.get(
    `/cliente/me/assinaturas/${signerId}/documento.pdf`,
    config,
  );
  const data: unknown = response.data;
  return data instanceof Blob ? data : new Blob([data as BlobPart], { type: "application/pdf" });
}

export function AssinaturaDocumento({ signerId, version }: AssinaturaDocumentoProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(null);
    setUrl(null);

    void (async () => {
      try {
        const blob = await fetchDocumento(signerId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e) {
        if (cancelled) return;
        setError(portalErrorMessage(e, "Não foi possível abrir o documento."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // O endereço morre com o componente. Sem isto, cada reabertura do
      // documento deixaria um blob inteiro preso na memória da aba — e um PDF
      // de orçamento selado tem várias páginas.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [signerId, version]);

  // LARGURA MEDIDA NO CONTAINER, com piso de legibilidade.
  //
  // Copiado da cerimônia pública pela mesma razão que ela o faz: largura fixa
  // empurrava a página inteira para rolagem horizontal no celular, e acompanhar
  // o container cegamente rendia uma folha A4 com ~345px — corpo de texto em
  // torno de 5px. Abaixo de 560px quem rola é ESTE quadro.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(840);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(560, Math.min(840, el.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <IconLoader2 className="h-4 w-4 animate-spin" />
        Carregando documento…
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="flex items-start gap-2 px-1 py-8 text-sm text-muted-foreground">
        <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error ?? "Não foi possível carregar o documento."}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end px-1">
        {/* Botão, e não link em letra miúda: no celular a folha sai pequena e
            abrir no visualizador nativo (com pinça para ampliar) é o caminho
            real de leitura, não uma saída secundária. */}
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-sm">
          <a href={url} target="_blank" rel="noreferrer">
            <IconExternalLink className="h-3.5 w-3.5" />
            Abrir em tela cheia
          </a>
        </Button>
      </div>
      {/* `overflow-x-auto` é cinto e suspensório: se a medição falhar, quem rola
          é este quadro, nunca a página. */}
      <div ref={boxRef} className="overflow-x-auto p-1">
        <InlineDocumentPages url={url} width={width} />
      </div>
    </div>
  );
}
