import { FileCardUploadField, type FileCardUploadFieldProps } from "@/components/common/file/file-card-upload-field";
import { LayoutStatusSelector } from "../layout";

export type LayoutFileUploadFieldProps = Omit<FileCardUploadFieldProps, "renderStatus">;

/**
 * O picker padrão (`FileCardUploadField`) COM o seletor de status de layout.
 *
 * Layout é o único tipo de arquivo com fluxo DRAFT/APPROVED/REPROVED, então o
 * seletor mora aqui e não no componente compartilhado — arquivos base, projetos
 * e evidências usam `FileCardUploadField` direto e não mostram status algum.
 */
export function LayoutFileUploadField({ showStatus = true, ...props }: LayoutFileUploadFieldProps) {
  return (
    <FileCardUploadField
      {...props}
      showStatus={showStatus}
      renderStatus={({ value, onChange, disabled, layout }) => (
        <LayoutStatusSelector
          value={value}
          onChange={onChange}
          // ATIVO TAMBÉM ANTES DO UPLOAD. O mapa `layoutStatuses` é chaveado por File ID,
          // que só existe depois que o arquivo sobe — mas o status escolhido agora NÃO se
          // perde: ele fica no próprio arquivo (`file.status`) e cada caminho de submissão
          // o traduz para o que a API espera (`newLayoutStatuses`, um array na MESMA ordem
          // dos blobs, ou o remapeamento id-temporário → File ID em quem sobe os arquivos
          // antes de salvar). Sem isso era preciso salvar a tarefa/aerografia só para
          // poder aprovar o layout que se acabou de anexar.
          disabled={disabled}
          {...(layout === "card"
            ? { className: "w-full", triggerClassName: "h-8 w-full justify-between" }
            : {})}
        />
      )}
    />
  );
}
