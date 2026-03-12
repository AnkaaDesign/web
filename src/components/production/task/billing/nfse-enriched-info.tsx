import { useNavigate } from 'react-router-dom';
import { IconLoader2, IconDownload } from '@tabler/icons-react';
import { formatCurrency, formatDate } from '@/utils';
import { useNfseDetail } from '@/hooks/financial/use-nfse';
import { nfseService } from '@/api-client/nfse';
import { routes } from '@/constants';

interface NfseEnrichedInfoProps {
  elotechNfseId: number;
  showPdfLink?: boolean;
}

export function NfseEnrichedInfo({ elotechNfseId, showPdfLink = false }: NfseEnrichedInfoProps) {
  const navigate = useNavigate();
  const { data: response, isLoading } = useNfseDetail(elotechNfseId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 mt-2 p-2 bg-muted/50 rounded-lg">
        <IconLoader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando dados da NFS-e...</span>
      </div>
    );
  }

  const detail = response?.data;
  if (!detail) return null;

  const formDados = detail.formDadosNFSe || {};
  const formImposto = detail.formImposto || {};
  const formTotal = detail.formTotal || {};

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await nfseService.getPdf(elotechNfseId);
      const blob = res.data instanceof Blob
        ? res.data
        : new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nfse-${formDados.numeroNfse || elotechNfseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  };

  return (
    <div
      className="mt-2 cursor-pointer hover:bg-muted/30 rounded-lg transition-colors"
      onClick={() => navigate(routes.financial.nfse.detail(elotechNfseId))}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-muted/50 rounded-lg">
        {formDados.numeroNfse && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Numero</p>
            <p className="text-xs font-semibold">{formDados.numeroNfse}</p>
          </div>
        )}
        {formDados.dataEmissao && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Emissao</p>
            <p className="text-xs font-semibold">{formatDate(formDados.dataEmissao)}</p>
          </div>
        )}
        {formTotal.totalNfse != null && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Valor</p>
            <p className="text-xs font-semibold">{formatCurrency(formTotal.totalNfse)}</p>
          </div>
        )}
        {formImposto.valorIss != null && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">ISS</p>
            <p className="text-xs font-semibold">{formatCurrency(formImposto.valorIss)}</p>
          </div>
        )}
      </div>
      {showPdfLink && (
        <div className="flex items-center gap-3 pt-1.5 px-1">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
          >
            <IconDownload className="h-3 w-3" />
            Baixar PDF
          </button>
        </div>
      )}
    </div>
  );
}
