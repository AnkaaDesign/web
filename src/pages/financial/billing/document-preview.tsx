import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { IconFileInvoice, IconBarcode, IconAlertTriangle } from "@tabler/icons-react";
import { NfsePreview, type NfsePreviewData } from "@/components/financial/billing/preview/nfse-preview";
import { BoletoPreview, type BoletoPreviewData } from "@/components/financial/billing/preview/boleto-preview";

/**
 * Full-page preview of a single NFS-e or boleto, opened in a NEW TAB from the
 * billing-approval modal (so the approval flow stays intact in the original
 * tab). The computed document data is handed off via localStorage under the key
 * passed in `?k=`; we read it, revive Dates, render, then clean it up.
 */
interface PreviewPayload {
  kind: "nfse" | "boleto";
  label: string;
  sublabel: string;
  data: any;
}

function revive(payload: PreviewPayload): PreviewPayload {
  if (payload.kind === "boleto" && payload.data) {
    payload.data.vencimento = new Date(payload.data.vencimento);
    if (payload.data.dataDocumento) payload.data.dataDocumento = new Date(payload.data.dataDocumento);
  }
  return payload;
}

export function BillingDocumentPreviewPage() {
  const [searchParams] = useSearchParams();
  const key = searchParams.get("k");
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!key) {
      setError(true);
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setError(true);
        return;
      }
      const parsed = revive(JSON.parse(raw));
      setPayload(parsed);
      document.title = `${parsed.label} — ${parsed.sublabel} (prévia)`;
      // One-shot handoff: remove so localStorage doesn't accumulate stale entries.
      localStorage.removeItem(key);
    } catch {
      setError(true);
    }
  }, [key]);

  const doc = useMemo(() => {
    if (!payload) return null;
    return payload.kind === "nfse" ? (
      <NfsePreview data={payload.data as NfsePreviewData} />
    ) : (
      <BoletoPreview data={payload.data as BoletoPreviewData} />
    );
  }, [payload]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-200 p-6 text-center dark:bg-neutral-900">
        <IconAlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-lg font-semibold">Pré-visualização indisponível</p>
        <p className="max-w-md text-sm text-muted-foreground">
          O conteúdo da pré-visualização expirou ou não foi encontrado. Feche esta aba e clique novamente no
          documento na tela de aprovação do faturamento.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-200 dark:bg-neutral-900">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-4 py-3 shadow-sm">
        {payload?.kind === "nfse" ? (
          <IconFileInvoice className="h-5 w-5 text-emerald-600" />
        ) : (
          <IconBarcode className="h-5 w-5 text-blue-600" />
        )}
        <div>
          <p className="text-sm font-semibold">{payload?.label}</p>
          <p className="text-xs text-muted-foreground">
            {payload?.sublabel} · pré-visualização — documento ainda não emitido
          </p>
        </div>
      </div>
      <div className="flex justify-center p-6">
        <div className="shadow-lg">{doc}</div>
      </div>
    </div>
  );
}

export default BillingDocumentPreviewPage;
