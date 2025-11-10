import { useState } from "react";
import { FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconFileTypePdf, IconCertificate, IconFileText } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type DocumentCategory = "contract" | "certificate" | "other";

interface DocumentsInputProps {
  disabled?: boolean;
  onFilesChange?: (category: DocumentCategory, files: FileWithPreview[]) => void;
  contractFiles?: FileWithPreview[];
  certificateFiles?: FileWithPreview[];
  otherDocumentFiles?: FileWithPreview[];
}

interface DocumentSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  category: DocumentCategory;
  files: FileWithPreview[];
  onFilesChange: (files: FileWithPreview[]) => void;
  disabled?: boolean;
  iconColor?: string;
}

function DocumentSection({
  title,
  description,
  icon,
  category,
  files,
  onFilesChange,
  disabled,
  iconColor = "text-primary"
}: DocumentSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn("flex-shrink-0", iconColor)}>
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <FileUploadField
        onFilesChange={onFilesChange}
        maxFiles={10}
        maxSize={10 * 1024 * 1024} // 10MB per file
        acceptedFileTypes={{
          "application/pdf": [".pdf"],
          "image/*": [".jpeg", ".jpg", ".png"],
          "application/msword": [".doc"],
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        }}
        disabled={disabled}
        showPreview={true}
        variant="compact"
        placeholder={`Clique ou arraste ${title.toLowerCase()} aqui`}
        existingFiles={files}
      />
    </div>
  );
}

export function DocumentsInput({
  disabled,
  onFilesChange,
  contractFiles = [],
  certificateFiles = [],
  otherDocumentFiles = []
}: DocumentsInputProps) {
  const [contracts, setContracts] = useState<FileWithPreview[]>(contractFiles);
  const [certificates, setCertificates] = useState<FileWithPreview[]>(certificateFiles);
  const [otherDocuments, setOtherDocuments] = useState<FileWithPreview[]>(otherDocumentFiles);

  const handleContractChange = (files: FileWithPreview[]) => {
    setContracts(files);
    if (onFilesChange) {
      onFilesChange("contract", files);
    }
  };

  const handleCertificateChange = (files: FileWithPreview[]) => {
    setCertificates(files);
    if (onFilesChange) {
      onFilesChange("certificate", files);
    }
  };

  const handleOtherDocumentChange = (files: FileWithPreview[]) => {
    setOtherDocuments(files);
    if (onFilesChange) {
      onFilesChange("other", files);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconFileText className="h-5 w-5" />
          Documentos do Fornecedor
        </CardTitle>
        <CardDescription>
          Anexe contratos, certificados e outros documentos relevantes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Contracts Section */}
        <DocumentSection
          title="Contratos"
          description="Contratos de fornecimento, acordos comerciais, etc."
          icon={<IconFileTypePdf className="h-5 w-5" />}
          category="contract"
          files={contracts}
          onFilesChange={handleContractChange}
          disabled={disabled}
          iconColor="text-red-500"
        />

        {/* Certificates Section */}
        <DocumentSection
          title="Certificados"
          description="Certificados de qualidade, conformidade, ISO, etc."
          icon={<IconCertificate className="h-5 w-5" />}
          category="certificate"
          files={certificates}
          onFilesChange={handleCertificateChange}
          disabled={disabled}
          iconColor="text-blue-500"
        />

        {/* Other Documents Section */}
        <DocumentSection
          title="Outros Documentos"
          description="Notas fiscais, recibos, documentos diversos"
          icon={<IconFileText className="h-5 w-5" />}
          category="other"
          files={otherDocuments}
          onFilesChange={handleOtherDocumentChange}
          disabled={disabled}
          iconColor="text-muted-foreground"
        />
      </CardContent>
    </Card>
  );
}

export default DocumentsInput;
