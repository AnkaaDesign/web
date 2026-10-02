// web/src/components/cliente/veiculo/veiculo-projeto-card.tsx
//
// O PROJETO DO IMPLEMENTO — o desenho da carroceria que a Furgões (ou quem
// fabricou o implemento) tem e a Ankaa precisa para medir e montar a arte.
//
// ⚠️ É do IMPLEMENTO, não da tarefa: o mesmo projeto vale para todo trabalho
// futuro naquele veículo. O projeto da TAREFA (a arte cotada) é outra coisa e
// não sai no portal.
//
// Quem pode enviar é quem escreve a identidade do veículo
// (`WRITE_VEHICLE_IDENTITY`); o servidor confere de novo.
import { useRef, useState } from "react";
import { IconExternalLink, IconFileUpload, IconLoader2, IconRuler2 } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { usePortalUploadImplementProject, type PortalFile } from "@/api-client/portal";
import { PortalCard } from "../portal-detail";
import { portalFileUrl } from "./portal-file-url";

/** O teto do servidor (`MAXIMO_PROJETOS`). */
const MAXIMO_PROJETOS = 10;

export function VeiculoProjetoCard({
  taskId,
  files,
  canWrite,
}: {
  taskId: string;
  files: PortalFile[];
  canWrite: boolean;
}) {
  const upload = usePortalUploadImplementProject();
  const input = useRef<HTMLInputElement | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!files.length && !canWrite) return null;

  const enviar = async (lista: FileList | null) => {
    const escolhidos = Array.from(lista ?? []).slice(0, MAXIMO_PROJETOS);
    if (!escolhidos.length) return;
    setErro(null);
    try {
      await upload.mutateAsync({ taskId, files: escolhidos });
    } catch {
      setErro("Não foi possível enviar o projeto. Tente de novo.");
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <PortalCard
      icon={IconRuler2}
      title="Projeto do implemento"
      description={
        files.length
          ? "O desenho da carroceria que a Ankaa usa para medir e montar a arte."
          : "Se você tem o projeto da carroceria (PDF ou imagem), envie aqui."
      }
    >
      <div className="space-y-3">
        {files.length ? (
          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file.id}>
                <a
                  href={portalFileUrl(file)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm hover:bg-muted"
                >
                  <IconExternalLink className="h-4 w-4 shrink-0" />
                  <span className="truncate">{file.originalName ?? file.filename ?? "Projeto"}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {canWrite ? (
          <>
            <input
              ref={input}
              type="file"
              className="hidden"
              multiple
              // PDF do fabricante, ou a foto do desenho tirada com o celular.
              accept="application/pdf,image/*"
              onChange={(event) => void enviar(event.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:w-auto"
              disabled={upload.isPending}
              onClick={() => input.current?.click()}
            >
              {upload.isPending ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <IconFileUpload className="mr-2 h-4 w-4" />
              )}
              {files.length ? "Enviar outro arquivo" : "Enviar o projeto"}
            </Button>
          </>
        ) : null}

        {erro ? (
          <p className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        ) : null}
      </div>
    </PortalCard>
  );
}
