import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import {
  IconLoader2,
  IconAlertCircle,
  IconDownload,
  IconUpload,
  IconCircleCheck,
  IconClock,
} from "@tabler/icons-react";

import { wasteCertificateService } from "@/api-client/waste-certificate";
import { getApiBaseUrl } from "@/utils/file";
import {
  downloadStoredPdf,
  certificateFilenameFromDate,
} from "@/utils/waste-certificate-pdf-generator";
import { CertificatePdfPreview } from "@/components/common/file/certificate-pdf-preview";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

export function PublicWasteCertificatePage() {
  const { id } = useParams<{ id: string }>();
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCertificate = useCallback(async () => {
    if (!id) {
      setError("Identificador não fornecido.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await wasteCertificateService.getPublic(id);
      if (res.data?.success && res.data?.data) {
        setCertificate(res.data.data);
        setError(null);
      } else {
        setError(res.data?.message || "Certificado não encontrado.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Certificado não encontrado.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCertificate();
  }, [fetchCertificate]);

  const activeFileId: string | null = certificate?.signedFileId || certificate?.pdfFileId || null;
  const isSigned = Boolean(certificate?.signedFileId);
  const pdfUrl = activeFileId ? `${getApiBaseUrl()}/files/serve/${activeFileId}` : null;

  const handleDownload = async () => {
    if (!activeFileId) return;
    try {
      await downloadStoredPdf(
        getApiBaseUrl(),
        activeFileId,
        certificateFilenameFromDate(certificate?.date),
      );
    } catch (err: any) {
      toast.error(err?.message || "Falha ao baixar o arquivo.");
    }
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    if (file.type !== "application/pdf") {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    try {
      setUploading(true);
      const res = await wasteCertificateService.uploadSignedPublic(id, file);
      if (res.data?.success) {
        toast.success("Documento assinado enviado com sucesso.");
        await fetchCertificate();
      } else {
        toast.error(res.data?.message || "Falha ao enviar o documento.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Falha ao enviar o documento.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-100">
        <IconLoader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-neutral-100 px-4 text-center">
        <IconAlertCircle className="h-12 w-12 text-red-500 mb-3" />
        <p className="text-neutral-700">{error || "Certificado não encontrado."}</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-100 px-4 py-3">
      <div className="w-full max-w-3xl mx-auto flex flex-col flex-1 min-h-0 gap-2">
        {/* PDF preview — the page canvas (with its own shadow) fills the height */}
        <div className="flex-1 min-h-0">
          {pdfUrl ? (
            <CertificatePdfPreview url={pdfUrl} />
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-400">
              PDF indisponível.
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex-shrink-0 flex items-center justify-center">
          {isSigned ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
              <IconCircleCheck className="h-4 w-4" /> Documento assinado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-neutral-500">
              <IconClock className="h-4 w-4" /> Aguardando documento assinado
            </span>
          )}
        </div>

        {/* Actions — two full-width buttons */}
        <div className="flex-shrink-0 flex gap-3">
          <Button
            onClick={handleDownload}
            disabled={!activeFileId}
            variant="secondary"
            className="flex-1 h-12 text-base gap-2 border border-neutral-300"
          >
            <IconDownload className="h-5 w-5" />
            Baixar certificado
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 h-12 text-base gap-2"
          >
            {uploading ? (
              <IconLoader2 className="h-5 w-5 animate-spin" />
            ) : (
              <IconUpload className="h-5 w-5" />
            )}
            {isSigned ? "Substituir PDF assinado" : "Enviar PDF assinado"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PublicWasteCertificatePage;
