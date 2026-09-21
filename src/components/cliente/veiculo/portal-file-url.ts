// web/src/components/cliente/veiculo/portal-file-url.ts
//
// A URL DE UM ARQUIVO PARA O PORTAL.
//
// É `getFileUrl` de `utils/file.ts` reduzido ao que o portal conhece: aquele
// helper pede o `File` inteiro da aplicação (com `filename`, `size`, `mimetype`
// e uma dúzia de relações), e o portal recebe de propósito um recorte — declarar
// o tipo inteiro só para montar uma URL arrastaria para cá um tipo que descreve
// coisas que o cliente não pode ver.
//
// ⚠️ E O RECORTE NÃO TEM `path`. `PortalFile` é `{ id, filename, originalName,
// mimetype, size, thumbnailUrl }` — o projetor omite `path` de propósito, porque
// ele é o caminho no disco do servidor e a árvore é literal
// (`Clientes/{razão social}/Boletos/`). A versão anterior destas funções pedia
// um `path` que nunca chega e caía sempre no ramo de reserva; agora o ramo de
// reserva é o único caminho, e está dito.
//
// ⚠️ Isto só funciona porque HOJE todo arquivo é público por UUID — o bloqueador
// do §9 do desenho (`PORTAL-DO-RESPONSAVEL.md`). Quando o pacote R10 fechar a
// porta, é ESTE ponto que passa a pedir link assinado, e `<img src>` nunca passa
// pelo interceptor do axios: quem emite o link tem de ser o servidor.
import { getApiBaseUrl } from "@/config/api";
import { rewriteCdnUrl } from "@/utils/file";

import type { PortalFile } from "@/api-client/portal";

/** O arquivo inteiro, para abrir em guia nova. */
export function portalFileUrl(file: Pick<PortalFile, "id"> | null | undefined): string {
  if (!file?.id) return "";
  return `${getApiBaseUrl()}/files/serve/${file.id}`;
}

/**
 * A MINIATURA, quando o servidor tiver gerado uma; senão o arquivo inteiro.
 *
 * `thumbnailUrl` pode vir absoluto (armazenamento remoto — `rewriteCdnUrl`
 * reaponta o CDN para a API local quando se está na rede da empresa) ou relativo
 * à API.
 */
export function portalThumbnailUrl(
  file: Pick<PortalFile, "id" | "thumbnailUrl"> | null | undefined,
): string {
  if (file?.thumbnailUrl) {
    return file.thumbnailUrl.startsWith("http")
      ? rewriteCdnUrl(file.thumbnailUrl)
      : `${getApiBaseUrl()}${file.thumbnailUrl.startsWith("/") ? "" : "/"}${file.thumbnailUrl}`;
  }
  return portalFileUrl(file);
}

/** A plaqueta — `Truck.vinPlate`, que chega como `PortalFile` dentro da identidade. */
export function portalVinPlateUrl(fileId: string | null | undefined): string {
  return fileId ? `${getApiBaseUrl()}/files/serve/${fileId}` : "";
}

/**
 * A MINIATURA da plaqueta, e não o arquivo inteiro.
 *
 * A foto da plaqueta sai de um celular no pátio: 3–8 MB é o normal. Desenhá-la a
 * 40 px pelo `/files/serve/` baixa os 8 MB inteiros — no 4G do pátio, que é
 * exatamente onde a pessoa está quando abre esta tela.
 */
export function portalVinPlateThumbUrl(fileId: string | null | undefined): string {
  return fileId ? `${getApiBaseUrl()}/files/thumbnail/${fileId}?size=medium&v=2` : "";
}
