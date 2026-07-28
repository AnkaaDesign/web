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
          disabled={disabled}
          {...(layout === "card"
            ? { className: "w-full", triggerClassName: "h-8 w-full justify-between" }
            : {})}
        />
      )}
    />
  );
}
