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
      renderStatus={({ value, onChange, disabled, layout, uploaded }) => (
        <LayoutStatusSelector
          value={value}
          onChange={onChange}
          // O mapa `layoutStatuses` é chaveado por File ID, que só passa a existir
          // depois do upload. Deixar o seletor ativo antes disso seria um controle
          // que aceita a escolha e a descarta no submit — um layout recém-solto
          // nasce Rascunho e só pode ser aprovado quando já estiver no servidor.
          disabled={disabled || !uploaded}
          {...(layout === "card"
            ? { className: "w-full", triggerClassName: "h-8 w-full justify-between" }
            : {})}
        />
      )}
    />
  );
}
