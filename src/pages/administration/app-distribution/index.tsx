import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  IconBrandAndroid,
  IconBrandApple,
  IconCheck,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconFileZip,
  IconHistory,
  IconRocket,
  IconUpload,
  IconX,
} from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { toast } from "@/components/ui/sonner";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useInstallHistory, useInstallVersion, usePublishInstall } from "@/hooks/administration/use-install";
import {
  installService,
  installUrls,
  type InstallHistoryEntry,
  type InstallPlatform,
  type PlatformVersionInfo,
} from "@/api-client/install";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function humanSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Per-platform upload + status card
// ---------------------------------------------------------------------------
interface PlatformCardConfig {
  platform: InstallPlatform;
  title: string;
  icon: React.ReactNode;
  acceptedFileTypes: Record<string, string[]>;
  extension: string;
  downloadUrl: string;
  downloadLabel: string;
  placeholder: string;
}

const MAX_BINARY_BYTES = 600 * 1024 * 1024; // matches the API upload cap

function PlatformDeployCard({
  config,
  info,
  loading,
}: {
  config: PlatformCardConfig;
  info?: PlatformVersionInfo;
  loading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [build, setBuild] = useState("");
  const [progress, setProgress] = useState(0);
  // Remounting the picker (via key) is how we clear its internal selection after publish.
  const [pickerKey, setPickerKey] = useState(0);

  const publish = usePublishInstall();
  const isUploading = publish.isPending;

  const handleFilesChange = (files: FileWithPreview[]) => {
    const selected = files[0] ?? null;
    setFile(selected);
    // Pre-fill from the currently published build to make a bump one keystroke away.
    if (selected) {
      if (!version && info?.version) setVersion(info.version);
      if (!build && info?.build) setBuild(info.build);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPickerKey((k) => k + 1); // remount the dropzone empty
  };

  const handlePublish = async () => {
    if (!file) {
      toast.error("Selecione um arquivo", { description: `Escolha um arquivo ${config.extension}.` });
      return;
    }
    if (!file.name.toLowerCase().endsWith(config.extension)) {
      toast.error("Arquivo inválido", {
        description: `O arquivo deve ter a extensão ${config.extension}.`,
      });
      return;
    }
    if (!version.trim() || !build.trim()) {
      toast.error("Versão e build são obrigatórios");
      return;
    }

    setProgress(0);
    try {
      await publish.mutateAsync({
        platform: config.platform,
        file,
        version: version.trim(),
        build: build.trim(),
        onProgress: setProgress,
      });
      // Reset the form on success.
      setFile(null);
      setVersion("");
      setBuild("");
      setProgress(0);
      setPickerKey((k) => k + 1);
    } catch {
      // Error toast handled by the hook.
      setProgress(0);
    }
  };

  const available = info?.available && !loading;

  return (
    <Card className="flex flex-1 flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            {config.icon}
          </span>
          <span>{config.title}</span>
          {available ? (
            <Badge variant="secondary" className="ml-auto">
              v{info?.version} ({info?.build})
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-auto font-normal text-muted-foreground">
              Sem versão
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {/* Published-build status line — only when a binary exists; reserved height keeps cards aligned */}
        <div className="flex h-5 items-center gap-2 text-xs text-muted-foreground">
          {available ? (
            <>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate">
                Publicado · {humanSize(info?.sizeBytes)} · {formatDate(info?.uploadedAt)}
              </span>
              <Button asChild variant="link" size="sm" className="ml-auto h-auto shrink-0 gap-1 p-0 text-xs">
                <a href={config.downloadUrl} download>
                  <IconDownload className="h-3.5 w-3.5" />
                  {config.downloadLabel}
                </a>
              </Button>
            </>
          ) : null}
        </div>

        {/* File picker (left) + version/build stacked (right). The picker stretches to the
            inputs' height so its top/bottom edges line up exactly, and it never grows/scrolls. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label>Arquivo ({config.extension})</Label>
            <div className="min-h-[6.5rem] flex-1">
              {file ? (
                <div className="flex h-full items-center gap-3 rounded-lg border border-border bg-muted/30 px-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
                    <IconFileZip className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{humanSize(file.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={isUploading}
                    onClick={clearFile}
                  >
                    <IconX className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <FileUploadField
                  key={pickerKey}
                  variant="compact"
                  maxFiles={1}
                  maxSize={MAX_BINARY_BYTES}
                  acceptedFileTypes={config.acceptedFileTypes}
                  showPreview={false}
                  showFiles={false}
                  placeholder={config.placeholder}
                  disabled={isUploading}
                  className="h-full [&>div]:h-full [&>div]:min-h-0"
                  onFilesChange={handleFilesChange}
                />
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:w-44">
            <div className="space-y-1.5">
              <Label htmlFor={`version-${config.platform}`}>Versão</Label>
              <Input
                id={`version-${config.platform}`}
                placeholder="1.2.0"
                value={version}
                disabled={isUploading}
                onChange={(value) => setVersion((value ?? "").toString())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`build-${config.platform}`}>Build</Label>
              <Input
                id={`build-${config.platform}`}
                placeholder="45"
                value={build}
                disabled={isUploading}
                onChange={(value) => setBuild((value ?? "").toString())}
              />
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-2">
          {isUploading ? (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-center text-xs text-muted-foreground">Enviando… {progress}%</p>
            </div>
          ) : null}

          <Button className="w-full" onClick={handlePublish} disabled={isUploading || !file}>
            <IconUpload className="h-4 w-4" />
            Publicar {config.title}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Share card — QR + link to the public /install page
// ---------------------------------------------------------------------------
function ShareCard() {
  const installUrl = `${window.location.origin}${routes.install}`;
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(installUrl, { errorCorrectionLevel: "M", margin: 1, width: 512 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [installUrl]);

  const handleCopy = () => {
    navigator.clipboard
      ?.writeText(installUrl)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            <IconExternalLink className="h-5 w-5" />
          </span>
          Página de instalação
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          {qr ? (
            <img
              src={qr}
              alt="QR code da página de instalação"
              className="h-64 w-64 sm:h-72 sm:w-72"
            />
          ) : (
            <div className="h-64 w-64 animate-pulse rounded-xl bg-muted sm:h-72 sm:w-72" />
          )}
        </div>
        <div className="w-full max-w-md space-y-4 text-sm text-muted-foreground">
          <p>
            Compartilhe este link (ou o QR Code) com os celulares. A página detecta o sistema e
            oferece a instalação correta: <span className="font-medium text-foreground">APK</span> no
            Android e instalação <span className="font-medium text-foreground">OTA</span> no iPhone.
          </p>
          <a
            href={installUrl}
            target="_blank"
            rel="noreferrer"
            className="block break-all text-base font-medium text-primary underline-offset-4 hover:underline"
          >
            {installUrl}
          </a>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={handleCopy}>
              {copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar link"}
            </Button>
            <Button asChild variant="outline">
              <a href={installUrl} target="_blank" rel="noreferrer">
                <IconExternalLink className="h-4 w-4" />
                Abrir
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// History table — superseded builds
// ---------------------------------------------------------------------------
function HistoryCard({ history, loading }: { history?: InstallHistoryEntry[]; loading: boolean }) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (entry: InstallHistoryEntry) => {
    setDownloadingId(entry.id);
    try {
      const blob = await installService.downloadArchive(entry.id);
      triggerBlobDownload(blob, entry.filename);
    } catch {
      toast.error("Falha ao baixar versão arquivada");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
            <IconHistory className="h-5 w-5" />
          </span>
          Histórico de versões
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : !history || history.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma versão anterior. Versões substituídas por novos envios aparecem aqui.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plataforma</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Build</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {entry.platform === "ios" ? (
                        <IconBrandApple className="h-4 w-4" />
                      ) : (
                        <IconBrandAndroid className="h-4 w-4" />
                      )}
                      {entry.platform === "ios" ? "iOS" : "Android"}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{entry.version}</TableCell>
                  <TableCell>{entry.build}</TableCell>
                  <TableCell>{humanSize(entry.sizeBytes)}</TableCell>
                  <TableCell>{formatDate(entry.uploadedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={downloadingId === entry.id}
                      onClick={() => handleDownload(entry)}
                    >
                      <IconDownload className="h-4 w-4" />
                      {downloadingId === entry.id ? "Baixando…" : "Baixar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function AppDistributionPage() {
  usePageTracker({ title: "Aplicativos Móveis", icon: "deployment" });

  const { data: version, isLoading: versionLoading, refetch, isFetching } = useInstallVersion();
  const { data: history, isLoading: historyLoading } = useInstallHistory();

  const cards = useMemo(
    (): PlatformCardConfig[] => [
      {
        platform: "ios",
        title: "iOS",
        icon: <IconBrandApple className="h-5 w-5" />,
        acceptedFileTypes: { "application/octet-stream": [".ipa"] },
        extension: ".ipa",
        downloadUrl: installUrls.ipa(),
        downloadLabel: "Baixar IPA atual",
        placeholder: "Arraste ou clique para selecionar o .ipa",
      },
      {
        platform: "android",
        title: "Android",
        icon: <IconBrandAndroid className="h-5 w-5" />,
        acceptedFileTypes: {
          "application/vnd.android.package-archive": [".apk"],
          "application/octet-stream": [".apk"],
        },
        extension: ".apk",
        downloadUrl: installUrls.apk(),
        downloadLabel: "Baixar APK atual",
        placeholder: "Arraste ou clique para selecionar o .apk",
      },
    ],
    [],
  );

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Aplicativos Móveis"
          icon={IconRocket}
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_APLICATIVOS_LISTAR}
          breadcrumbs={[
            { label: "Administração", href: routes.administration.root },
            { label: "Aplicativos Móveis" },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRocket,
              onClick: () => refetch(),
              loading: isFetching,
              variant: "outline",
            },
          ]}
        />

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden pb-4">
          <div className="grid shrink-0 items-stretch gap-4 lg:grid-cols-2">
            {/* Left: iOS + Android upload cards stacked, sharing the row height with the QR card */}
            <div className="flex h-full flex-col gap-4">
              {cards.map((config) => (
                <PlatformDeployCard
                  key={config.platform}
                  config={config}
                  info={config.platform === "ios" ? version?.ios : version?.android}
                  loading={versionLoading}
                />
              ))}
            </div>

            {/* Right: shareable install page (QR + link) */}
            <ShareCard />
          </div>

          <div className="min-h-0 flex-1">
            <HistoryCard history={history} loading={historyLoading} />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
}

export default AppDistributionPage;
