import { useEffect, useMemo, useState } from "react";
import { IconRecycle, IconLoader2, IconFileCertificate, IconExternalLink } from "@tabler/icons-react";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { StandardizedTable, type StandardizedColumn } from "@/components/ui/standardized-table";
import { useTableState } from "@/hooks/common/use-table-state";
import { toast } from "@/components/ui/sonner";
import { routes } from "@/constants";
import { getApiBaseUrl } from "@/utils/file";
import { CertificatePdfPreview } from "@/components/common/file/certificate-pdf-preview";
import {
  generateWasteCertificatePdf,
  buildCertificateFilename,
  downloadStoredPdf,
  certificateFilenameFromDate,
  type WasteCertificateData,
} from "@/utils/waste-certificate-pdf-generator";
import {
  useWasteCertificates,
  useCreateWasteCertificate,
  useDeleteWasteCertificate,
} from "@/hooks/useWasteCertificate";
import {
  WasteCertificateContextMenu,
  type WasteCertificateAction,
  type WasteCertificateContextMenuState,
} from "./waste-certificate-context-menu";

const formatBR = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export function WasteCertificateToolPage() {
  const today = useMemo(() => new Date(), []);

  const [date, setDate] = useState<Date | null>(today);
  const [periodStart, setPeriodStart] = useState<Date | null>(null);
  const [periodEnd, setPeriodEnd] = useState<Date | null>(null);
  const [description, setDescription] = useState("RESÍDUOS LIQUIDO CLASSE I");
  const [volume, setVolume] = useState("");
  const [previewData, setPreviewData] = useState<Uint8Array | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<WasteCertificateContextMenuState | null>(null);
  // The saved certificate currently loaded in the form (enables "Abrir").
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Table state (pagination/sorting) — 5 rows per page.
  const { page, pageSize, sortConfigs, setPage, setPageSize, toggleSort, getSortDirection, getSortOrder } =
    useTableState({ defaultPageSize: 10 });

  const orderBy = useMemo(() => {
    if (sortConfigs.length === 0) return undefined;
    const c = sortConfigs[0];
    return { [c.column]: c.direction } as Record<string, "asc" | "desc">;
  }, [sortConfigs]);

  const { data: listData, isLoading: listLoading } = useWasteCertificates({
    page: page + 1,
    limit: pageSize,
    orderBy,
  });
  const createMutation = useCreateWasteCertificate();
  const deleteMutation = useDeleteWasteCertificate();

  const certificates: any[] = listData?.data ?? [];
  const totalRecords: number = listData?.meta?.totalRecords ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const buildData = (): WasteCertificateData | null => {
    if (!date || !periodStart || !periodEnd) return null;
    if (!description.trim() || !volume.trim()) return null;
    if (periodEnd < periodStart) return null;
    return { date, periodStart, periodEnd, description: description.trim(), volume: volume.trim() };
  };

  const isValid = buildData() !== null;

  // Live preview — debounced so it doesn't flicker on every keystroke.
  useEffect(() => {
    const data = buildData();
    if (!data) {
      setPreviewData(undefined);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      const blob = await generateWasteCertificatePdf(data);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (!cancelled) setPreviewData(bytes);
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, periodStart, periodEnd, description, volume]);

  const handleGenerate = async () => {
    const data = buildData();
    if (!data) {
      toast.error("Preencha todos os campos corretamente.");
      return;
    }
    try {
      const blob = await generateWasteCertificatePdf(data);
      const filename = buildCertificateFilename(data);
      const res: any = await createMutation.mutateAsync({
        pdf: blob,
        filename,
        date: data.date,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        description: data.description,
        volume: data.volume,
      });
      setCurrentId(res?.data?.id ?? null);
      toast.success("Certificado gerado com sucesso.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao gerar o certificado.");
    }
  };

  const openCertificate = (id: string) => {
    window.open(routes.publicWasteCertificate(id), "_blank");
  };

  // Load a saved certificate's data into the form to view/edit it.
  const loadIntoForm = (item: any) => {
    const toDate = (v: any) => {
      const d = v ? new Date(v) : null;
      return d && !Number.isNaN(d.getTime()) ? d : null;
    };
    setDate(toDate(item.date));
    setPeriodStart(toDate(item.periodStart));
    setPeriodEnd(toDate(item.periodEnd));
    setDescription(item.description ?? "");
    setVolume(item.volume ?? "");
    setCurrentId(item.id ?? null);
  };

  const copyPublicLink = (id: string) => {
    const url = `${window.location.origin}${routes.publicWasteCertificate(id)}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link público copiado."),
      () => toast.error("Não foi possível copiar o link."),
    );
  };

  const handleAction = async (action: WasteCertificateAction, item: any) => {
    setContextMenu(null);
    switch (action) {
      case "open-here":
        loadIntoForm(item);
        break;
      case "download":
      case "download-signed": {
        const signed = action === "download-signed";
        const fileId = signed ? item.signedFileId : item.pdfFileId;
        if (!fileId) break;
        const base = certificateFilenameFromDate(item.date).replace(/\.pdf$/i, "");
        const filename = signed ? `${base}_ASSINADO.pdf` : `${base}.pdf`;
        try {
          await downloadStoredPdf(getApiBaseUrl(), fileId, filename);
        } catch (err: any) {
          toast.error(err?.message || "Falha ao baixar o arquivo.");
        }
        break;
      }
      case "copy-link":
        copyPublicLink(item.id);
        break;
      case "open":
        window.open(routes.publicWasteCertificate(item.id), "_blank");
        break;
      case "delete":
        if (!window.confirm("Remover este certificado do histórico?")) return;
        try {
          await deleteMutation.mutateAsync(item.id);
          toast.success("Certificado removido.");
        } catch (err: any) {
          toast.error(err?.response?.data?.message || "Erro ao remover.");
        }
        break;
    }
  };

  const columns: StandardizedColumn<any>[] = [
    {
      key: "description",
      header: "Descrição",
      accessor: (c) => c.description,
      sortable: true,
      className: "min-w-[200px] truncate",
      align: "left",
    },
    {
      key: "date",
      header: "Emissão",
      accessor: (c) => formatBR(c.date),
      sortable: true,
      className: "w-28 whitespace-nowrap",
      align: "left",
    },
    {
      key: "periodStart",
      header: "Início",
      accessor: (c) => formatBR(c.periodStart),
      sortable: true,
      className: "w-28 whitespace-nowrap",
      align: "left",
    },
    {
      key: "periodEnd",
      header: "Fim",
      accessor: (c) => formatBR(c.periodEnd),
      sortable: true,
      className: "w-28 whitespace-nowrap",
      align: "left",
    },
    {
      key: "volume",
      header: "Volume",
      accessor: (c) => c.volume,
      sortable: true,
      className: "w-28",
      align: "center",
    },
    {
      key: "status",
      header: "Status",
      accessor: (c) => (
        <Badge variant={c.status === "SIGNED" ? "completed" : "secondary"}>
          {c.status === "SIGNED" ? "Assinado" : "Gerado"}
        </Badge>
      ),
      sortable: true,
      className: "w-28",
      align: "center",
    },
  ];

  return (
    <div className="h-full flex flex-col px-4 pt-4 pb-4 overflow-hidden">
      <div className="flex-shrink-0">
        <PageHeader
          title="Certificado de Resíduos"
          icon={IconRecycle}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Ferramentas", href: routes.tools.root },
            { label: "Certificado de Resíduos" },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 mt-4">
        {/* LEFT: form on top, history below */}
        <div className="lg:w-1/2 flex flex-col gap-4 min-h-0">
          {/* Form */}
          <Card className="flex-shrink-0 flex flex-col overflow-hidden">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-lg">Dados do certificado</CardTitle>
              <CardDescription>
                Preencha os dados e compartilhe o certificado por link público.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Data de emissão</Label>
                <DateTimeInput
                  mode="date"
                  value={date}
                  onChange={(d) => setDate(d instanceof Date ? d : null)}
                  hideLabel
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Período (início)</Label>
                  <DateTimeInput
                    mode="date"
                    value={periodStart}
                    onChange={(d) => setPeriodStart(d instanceof Date ? d : null)}
                    hideLabel
                  />
                </div>
                <div className="space-y-2">
                  <Label>Período (fim)</Label>
                  <DateTimeInput
                    mode="date"
                    value={periodEnd}
                    onChange={(d) => setPeriodEnd(d instanceof Date ? d : null)}
                    hideLabel
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wc-desc">Descrição</Label>
                <Input
                  id="wc-desc"
                  value={description}
                  onChange={(value) => setDescription((value as string) ?? "")}
                  placeholder="RESÍDUOS LIQUIDO CLASSE I"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wc-volume">Volume</Label>
                <Input
                  id="wc-volume"
                  value={volume}
                  onChange={(value) => setVolume((value as string) ?? "")}
                  placeholder="792L"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleGenerate}
                disabled={!isValid || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <IconLoader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <IconFileCertificate className="h-4 w-4" />
                )}
                Gerar Certificado
              </Button>
            </CardContent>
          </Card>

          {/* History — fills the remaining left-column height */}
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-lg">Histórico</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <StandardizedTable
                columns={columns}
                data={certificates}
                getItemKey={(c) => c.id}
                isLoading={listLoading}
                emptyMessage="Nenhum certificado gerado ainda."
                onRowClick={(item) => loadIntoForm(item)}
                onContextMenu={(e, item) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, item });
                }}
                onSort={toggleSort}
                getSortDirection={getSortDirection}
                getSortOrder={getSortOrder}
                sortConfigs={sortConfigs.map((config) => ({ field: config.column, direction: config.direction }))}
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalRecords={totalRecords}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 20, 50]}
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: preview, full available height */}
        <Card className="lg:w-1/2 flex flex-col overflow-hidden min-h-0">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Pré-visualização</CardTitle>
                <CardDescription>Confira o documento antes de gerar.</CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-1.5 flex-shrink-0"
                disabled={!currentId}
                onClick={() => currentId && openCertificate(currentId)}
              >
                <IconExternalLink className="h-4 w-4" />
                Abrir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <div className="h-full rounded-md bg-muted/30">
              {previewData ? (
                <CertificatePdfPreview data={previewData} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                  <IconFileCertificate className="h-10 w-10 mb-2 opacity-50" />
                  Preencha os campos para visualizar.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <WasteCertificateContextMenu
        contextMenu={contextMenu}
        onClose={() => setContextMenu(null)}
        onAction={handleAction}
      />
    </div>
  );
}

export default WasteCertificateToolPage;
