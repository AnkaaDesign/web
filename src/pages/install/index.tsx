import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import {
  IconBrandApple,
  IconBrandAndroid,
  IconDeviceMobile,
  IconDownload,
  IconExternalLink,
  IconInfoCircle,
  IconReload,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/config/api";
import { DEPLOYMENT_DOMAINS } from "@/config/deployment";
import { detectPlatform, openNativeApp, type Platform } from "@/utils/platform";

// ---------------------------------------------------------------------------
// API contract
// ---------------------------------------------------------------------------
interface PlatformBuild {
  version: string;
  build: string | number;
  sizeBytes: number;
  uploadedAt: string;
  available: boolean;
}

interface VersionResponse {
  ios: PlatformBuild;
  android: PlatformBuild;
}

// Web/universal-link domain — the QR encodes this so a desktop visitor can open
// the same /install page on their phone.
const INSTALL_URL = `https://${DEPLOYMENT_DOMAINS.production}/install`;

function humanSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function useInstallVersion() {
  const [data, setData] = useState<VersionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`${getApiBaseUrl()}/install/version`, { headers: { Accept: "application/json" } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: VersionResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { data, loading, error, refetch: () => setNonce((n) => n + 1) };
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------
function VersionLine({ build, loading }: { build?: PlatformBuild; loading: boolean }) {
  if (loading) {
    return <div className="h-5 w-40 animate-pulse rounded bg-muted" />;
  }
  if (!build) {
    return <p className="text-sm text-muted-foreground">Versão indisponível</p>;
  }
  return (
    <p className="text-sm text-muted-foreground">
      Versão <span className="font-medium text-foreground">{build.version}</span>
      {build.build ? <span className="text-muted-foreground"> ({build.build})</span> : null}
      <span className="mx-2 text-border">•</span>
      {humanSize(build.sizeBytes)}
    </p>
  );
}

function QrPanel() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(INSTALL_URL, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        /* QR is a convenience; the URL is shown as text regardless. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        {dataUrl ? (
          <img src={dataUrl} alt="QR code para instalar o aplicativo Ankaa" className="h-48 w-48" />
        ) : (
          <div className="h-48 w-48 animate-pulse rounded-lg bg-muted" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Aponte a câmera do celular para o código</p>
        <a
          href={INSTALL_URL}
          className="mt-1 inline-block break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {INSTALL_URL}
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function InstallPage() {
  const [searchParams] = useSearchParams();
  const { data, loading, error, refetch } = useInstallVersion();
  const [appOpenFailed, setAppOpenFailed] = useState(false);

  // Allow forcing a platform view via ?platform= for testing/support.
  const platform: Platform = useMemo(() => {
    const forced = searchParams.get("platform");
    if (forced === "ios" || forced === "android" || forced === "desktop") return forced;
    return detectPlatform();
  }, [searchParams]);

  const fromPath = searchParams.get("from") || "";
  const apiBase = getApiBaseUrl();

  const iosInstallUrl = `itms-services://?action=download-manifest&url=${apiBase}/install/manifest.plist`;
  const androidApkUrl = `${apiBase}/install/android/app.apk`;

  const handleOpenApp = () => {
    setAppOpenFailed(false);
    openNativeApp(fromPath, () => setAppOpenFailed(true));
  };

  const iosBuild = data?.ios;
  const androidBuild = data?.android;
  const iosUnavailable = !loading && (!iosBuild || iosBuild.available === false);
  const androidUnavailable = !loading && (!androidBuild || androidBuild.available === false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 py-12">
        {/* Brand */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <IconDeviceMobile className="h-8 w-8" stroke={1.75} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Instale o app Ankaa
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
            O sistema Ankaa é feito para celular. Instale o aplicativo para acessar tudo com a melhor
            experiência.
          </p>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {error ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar as informações da versão.
              </p>
              <Button variant="outline" size="sm" onClick={refetch}>
                <IconReload className="h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          ) : platform === "ios" ? (
            <PlatformActions
              icon={<IconBrandApple className="h-6 w-6" stroke={1.75} />}
              title="iPhone / iPad"
              build={iosBuild}
              loading={loading}
              primaryLabel="Instalar no iPhone"
              primaryIcon={<IconDownload className="h-5 w-5" />}
              primaryHref={iosInstallUrl}
              primaryDisabled={iosUnavailable}
              onOpenApp={handleOpenApp}
              note="Importante: abra esta página no Safari para concluir a instalação."
              appOpenFailed={appOpenFailed}
            />
          ) : platform === "android" ? (
            <PlatformActions
              icon={<IconBrandAndroid className="h-6 w-6" stroke={1.75} />}
              title="Android"
              build={androidBuild}
              loading={loading}
              primaryLabel="Baixar APK"
              primaryIcon={<IconDownload className="h-5 w-5" />}
              primaryHref={androidApkUrl}
              primaryDownload
              primaryDisabled={androidUnavailable}
              onOpenApp={handleOpenApp}
              note="Após baixar, toque no arquivo e permita a instalação de apps do navegador."
              appOpenFailed={appOpenFailed}
            />
          ) : (
            // Desktop
            <div className="flex flex-col items-center gap-8">
              <QrPanel />
              <div className="w-full space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                  <IconInfoCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Escaneie o código acima com o celular para abrir esta página de instalação no
                      seu dispositivo.
                    </p>
                    <ol className="list-decimal space-y-1 pl-4">
                      <li>No iPhone, abra o link no Safari e toque em "Instalar no iPhone".</li>
                      <li>No Android, toque em "Baixar APK" e permita a instalação.</li>
                    </ol>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                      <IconBrandApple className="h-5 w-5" stroke={1.75} /> iPhone
                    </div>
                    <VersionLine build={iosBuild} loading={loading} />
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                      <IconBrandAndroid className="h-5 w-5" stroke={1.75} /> Android
                    </div>
                    <VersionLine build={androidBuild} loading={loading} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Ankaa Design • {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-platform action block (iOS / Android share the same shape)
// ---------------------------------------------------------------------------
interface PlatformActionsProps {
  icon: React.ReactNode;
  title: string;
  build?: PlatformBuild;
  loading: boolean;
  primaryLabel: string;
  primaryIcon: React.ReactNode;
  primaryHref: string;
  primaryDownload?: boolean;
  primaryDisabled?: boolean;
  onOpenApp: () => void;
  note: string;
  appOpenFailed: boolean;
}

function PlatformActions({
  icon,
  title,
  build,
  loading,
  primaryLabel,
  primaryIcon,
  primaryHref,
  primaryDownload,
  primaryDisabled,
  onOpenApp,
  note,
  appOpenFailed,
}: PlatformActionsProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
          {icon}
        </div>
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <VersionLine build={build} loading={loading} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Primary: install/download */}
        {primaryDisabled ? (
          <Button size="lg" className="w-full" disabled>
            {primaryIcon}
            {primaryLabel}
          </Button>
        ) : (
          <Button asChild size="lg" className="w-full">
            <a href={primaryHref} {...(primaryDownload ? { download: true } : {})}>
              {primaryIcon}
              {primaryLabel}
            </a>
          </Button>
        )}
        {primaryDisabled ? (
          <p className="text-center text-xs text-muted-foreground">
            Esta versão ainda não está disponível para download.
          </p>
        ) : null}

        {/* Secondary: open the already-installed app */}
        <Button variant="outline" size="lg" className="w-full" onClick={onOpenApp}>
          <IconExternalLink className="h-5 w-5" />
          Abrir o app
        </Button>
        {appOpenFailed ? (
          <p className="text-center text-xs text-muted-foreground">
            Não conseguimos abrir o app. Use o botão acima para instalá-lo primeiro.
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground",
        )}
      >
        <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{note}</span>
      </div>
    </div>
  );
}

export default InstallPage;
