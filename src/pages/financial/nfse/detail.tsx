import { useParams, Navigate, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useNfseDetail, useNfsePdfBlob } from "@/hooks/financial/use-nfse";
import { formatCurrency, formatDate } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlinePdfViewer } from "@/components/common/file/inline-pdf-viewer";
import {
  IconRefresh,
  IconDownload,
  IconLoader2,
  IconFileInvoice,
  IconUser,
  IconFileText,
  IconReceipt,
} from "@tabler/icons-react";

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  if (value == null || value === "" || value === "-") return null;

  return (
    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function formatDocument(doc: string | null | undefined): string {
  if (!doc) return "";
  const clean = doc.replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (clean.length === 14) {
    return clean.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }
  return doc;
}

export function NfseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const elotechNfseId = Number(id);

  usePageTracker({ title: "Detalhe NFS-e", icon: "receipt" });

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useNfseDetail(elotechNfseId);

  const { data: pdfBlobUrl, isLoading: isPdfLoading } =
    useNfsePdfBlob(elotechNfseId);

  if (!id || isNaN(elotechNfseId)) {
    return <Navigate to={routes.financial.nfse.root} replace />;
  }

  if (error) {
    return (
      <PrivilegeRoute
        requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL]}
      >
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-destructive">Erro ao carregar NFS-e</p>
          <button
            className="text-sm text-muted-foreground underline hover:text-foreground"
            onClick={() => navigate(routes.financial.nfse.root)}
          >
            Voltar para lista
          </button>
        </div>
      </PrivilegeRoute>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute
        requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL]}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PrivilegeRoute>
    );
  }

  const detail = response?.data;
  if (!detail) {
    return <Navigate to={routes.financial.nfse.root} replace />;
  }

  // Extract Elotech sections
  const formTomador = detail.formTomador || {};
  const formDados = detail.formDadosNFSe || {};
  const formImposto = detail.formImposto || {};
  const formTotal = detail.formTotal || {};

  // Derive status from local NfseDocument status
  const localStatus = detail.localStatus;
  const isCancelada = localStatus === "CANCELLED";
  const isEmitida = localStatus === "AUTHORIZED" || !isCancelada;

  const documentNumber = formDados.numeroNfse || elotechNfseId;

  // Tomador data
  const tomadorName = formTomador.razao || detail.customerName;
  const tomadorDocument = formatDocument(formTomador.cnpjCpf);
  const tomadorAddress = [
    formTomador.endereco,
    formTomador.numeroEndereco,
    formTomador.complementoEndereco,
    formTomador.bairro,
    formTomador.cidade?.descricao,
    formTomador.uf?.descricao || formTomador.uf?.id?.unidadeFederacao,
  ]
    .filter(Boolean)
    .join(", ");
  const tomadorCep = formTomador.cep;
  const tomadorPhone = formTomador.telefone;
  const tomadorEmail = formTomador.email;

  // Servico data
  const servicoCode = formDados.servicoLC?.id;
  const servicoDesc = formDados.servicoLC?.descricao;
  const cnaeCode = formDados.cnae?.id || formDados.cnae?.codigo;
  const cnaeDesc = formDados.cnae?.descricao;
  const naturezaOperacao = formDados.naturezaOperacao?.descricao;
  const discriminacao = formDados.discriminacaoServico;
  const regimeFiscal = formDados.regimeFiscal;

  const handleDownloadPdf = async () => {
    if (pdfBlobUrl) {
      const a = document.createElement("a");
      a.href = pdfBlobUrl;
      a.download = `nfse-${documentNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <PrivilegeRoute
      requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={`NFS-e #${documentNumber}`}
          breadcrumbs={[
            { label: "Inicio", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Notas Fiscais", href: routes.financial.nfse.root },
            { label: `NFS-e #${documentNumber}` },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              loading: isRefetching,
              variant: "outline" as const,
            },
            {
              key: "pdf",
              label: "Baixar PDF",
              icon: IconDownload,
              onClick: handleDownloadPdf,
              disabled: !pdfBlobUrl,
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Dados da Nota + Valores Totais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Document Info Card */}
              <Card className="shadow-sm border border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
                    Dados da Nota
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Status
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {isCancelada ? (
                          <Badge variant="cancelled">Cancelada</Badge>
                        ) : isEmitida ? (
                          <Badge variant="green">Emitida</Badge>
                        ) : (
                          <Badge variant="default">Pendente</Badge>
                        )}
                      </span>
                    </div>

                    <InfoRow label="Numero" value={formDados.numeroNfse} />

                    <InfoRow
                      label="Data Emissao"
                      value={
                        formDados.dataEmissao
                          ? formatDate(formDados.dataEmissao)
                          : null
                      }
                    />

                    <InfoRow
                      label="Valor do Documento"
                      value={
                        formTotal.totalNfse != null
                          ? formatCurrency(formTotal.totalNfse)
                          : null
                      }
                    />

                    <InfoRow
                      label="Base de Calculo ISS"
                      value={
                        formTotal.baseCalculoIss != null
                          ? formatCurrency(formTotal.baseCalculoIss)
                          : null
                      }
                    />

                    <InfoRow
                      label="Valor ISS"
                      value={
                        formImposto.valorIss != null
                          ? formatCurrency(formImposto.valorIss)
                          : null
                      }
                    />

                    <InfoRow
                      label="Aliquota ISS"
                      value={
                        formImposto.aliquotaIss != null
                          ? `${formImposto.aliquotaIss}%`
                          : null
                      }
                    />

                    <InfoRow
                      label="ISS Retido"
                      value={formImposto.issRetido ? "Sim" : "Nao"}
                    />

                    <InfoRow
                      label="Natureza da Operacao"
                      value={naturezaOperacao}
                    />

                    <InfoRow label="Regime Fiscal" value={regimeFiscal} />

                    {detail.taskName && (
                      <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                        <span className="text-sm font-medium text-muted-foreground">Tarefa</span>
                        <button
                          type="button"
                          onClick={() => detail.taskId && navigate(routes.production.history.details(detail.taskId))}
                          className="text-sm font-semibold text-primary hover:text-primary/80 hover:underline transition-colors"
                        >
                          {detail.taskName}
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Valores Totais Card */}
              <Card className="shadow-sm border border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconReceipt className="h-5 w-5 text-muted-foreground" />
                    Valores Totais
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <InfoRow
                      label="Total Descontos Condicionados"
                      value={
                        formTotal.totalDescontosCondicionados != null
                          ? formatCurrency(formTotal.totalDescontosCondicionados)
                          : null
                      }
                    />
                    <InfoRow
                      label="Total Descontos Incondicionados"
                      value={
                        formTotal.totalDescontosIncondicionados != null
                          ? formatCurrency(
                              formTotal.totalDescontosIncondicionados
                            )
                          : null
                      }
                    />
                    <InfoRow
                      label="% Deducoes"
                      value={
                        formTotal.percentualDeducoes != null
                          ? `${formTotal.percentualDeducoes}%`
                          : null
                      }
                    />
                    <InfoRow
                      label="Total Deducoes"
                      value={
                        formTotal.totalDeducoes != null
                          ? formatCurrency(formTotal.totalDeducoes)
                          : null
                      }
                    />
                    <InfoRow
                      label="Base de Calculo do ISS"
                      value={
                        formTotal.baseCalculoIss != null
                          ? formatCurrency(formTotal.baseCalculoIss)
                          : null
                      }
                    />
                    <InfoRow
                      label="Valor dos Impostos"
                      value={
                        formTotal.valorImpostos != null
                          ? formatCurrency(formTotal.valorImpostos)
                          : null
                      }
                    />
                    <InfoRow
                      label="Valor Liquido"
                      value={
                        formTotal.valorLiquidoNfse != null
                          ? formatCurrency(formTotal.valorLiquidoNfse)
                          : null
                      }
                    />
                    <div className="flex justify-between items-center bg-primary/10 rounded-lg px-4 py-3 border border-primary/20">
                      <span className="text-sm font-semibold text-foreground">
                        Total da Nota Fiscal
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {formTotal.totalNfse != null
                          ? formatCurrency(formTotal.totalNfse)
                          : "-"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tomador + Servico */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tomador Card */}
              <Card className="shadow-sm border border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconUser className="h-5 w-5 text-muted-foreground" />
                    Tomador
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <InfoRow label="Nome/Razao Social" value={tomadorName} />
                    <InfoRow label="CPF/CNPJ" value={tomadorDocument} />
                    {tomadorAddress && (
                      <InfoRow label="Endereco" value={tomadorAddress} />
                    )}
                    <InfoRow label="CEP" value={tomadorCep} />
                    <InfoRow label="Telefone" value={tomadorPhone} />
                    <InfoRow label="Email" value={tomadorEmail} />
                  </div>
                </CardContent>
              </Card>

              {/* Service Card */}
              {(discriminacao || servicoCode || cnaeCode) && (
                <Card className="shadow-sm border border-border">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <IconFileText className="h-5 w-5 text-muted-foreground" />
                      Servico
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <InfoRow
                        label="Codigo do Servico"
                        value={
                          servicoCode
                            ? servicoDesc
                              ? `${servicoCode} - ${servicoDesc}`
                              : servicoCode
                            : null
                        }
                      />

                      <InfoRow
                        label="CNAE"
                        value={
                          cnaeCode
                            ? cnaeDesc
                              ? `${cnaeCode} - ${cnaeDesc}`
                              : cnaeCode
                            : null
                        }
                      />

                      {discriminacao && (
                        <div className="bg-muted/50 rounded-lg px-4 py-3">
                          <span className="text-sm font-medium text-muted-foreground block mb-2">
                            Discriminacao
                          </span>
                          <p className="text-sm font-semibold text-foreground whitespace-pre-wrap">
                            {discriminacao}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* PDF Viewer */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="shadow-sm border border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
                    Documento PDF
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {isPdfLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12">
                      <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Carregando PDF...
                      </span>
                    </div>
                  ) : pdfBlobUrl ? (
                    <InlinePdfViewer
                      url={pdfBlobUrl}
                      className="rounded-lg bg-muted/30"
                      maxHeight="calc(100vh - 300px)"
                      onDownload={handleDownloadPdf}
                    />
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <span className="text-sm text-muted-foreground">
                        PDF nao disponivel
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
}

export default NfseDetailPage;
