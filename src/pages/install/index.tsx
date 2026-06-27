import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import {
  IconBrandApple,
  IconBrandAndroid,
  IconBrandSafari,
  IconAlertTriangle,
  IconCheck,
  IconCopy,
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
import {
  detectPlatform,
  isIOSNonSafari,
  openInSafari,
  openNativeApp,
  type Platform,
} from "@/utils/platform";

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
    return <p className="text-base text-muted-foreground">Versão indisponível</p>;
  }
  return (
    <p className="text-base text-muted-foreground">
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
          <img src={dataUrl} alt="QR code para instalar o aplicativo Ankaa" className="h-52 w-52" />
        ) : (
          <div className="h-52 w-52 animate-pulse rounded-lg bg-muted" />
        )}
      </div>
      <div className="text-center">
        <p className="text-base text-muted-foreground">Aponte a câmera do celular para o código</p>
        <a
          href={INSTALL_URL}
          className="mt-1 inline-block break-all text-base font-medium text-primary underline-offset-4 hover:underline"
        >
          {INSTALL_URL}
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// iOS-not-Safari warning — the OTA install only works in Safari
// ---------------------------------------------------------------------------
function SafariRequiredBanner() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      ?.writeText(INSTALL_URL)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        /* Clipboard may be blocked; the link is shown below regardless. */
      });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-500/40 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <IconAlertTriangle
          className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400"
          stroke={1.75}
        />
        <div className="space-y-1">
          <p className="text-base font-semibold text-amber-900 dark:text-amber-200">
            Abra no Safari para instalar
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200/80">
            No iPhone, a instalação só funciona pelo Safari. Você está em outro navegador.
          </p>
        </div>
      </div>

      <Button
        size="lg"
        className="h-14 w-full bg-amber-600 text-base font-semibold text-white hover:bg-amber-700"
        onClick={() => openInSafari(INSTALL_URL)}
      >
        <IconBrandSafari className="h-5 w-5" />
        Abrir no Safari
      </Button>

      <Button variant="outline" size="lg" className="h-14 w-full text-base" onClick={handleCopy}>
        {copied ? <IconCheck className="h-5 w-5" /> : <IconCopy className="h-5 w-5" />}
        {copied ? "Link copiado!" : "Copiar link"}
      </Button>

      <p className="text-sm text-amber-800 dark:text-amber-200/80">
        Se o botão não abrir o Safari, copie o link, abra o Safari manualmente e cole o endereço. Em
        apps como Instagram ou WhatsApp, toque em{" "}
        <span className="font-medium">••• → Abrir no Safari</span>.
      </p>
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

  // On iOS the OTA install only works in Safari; warn when in another browser.
  const iosNeedsSafari = useMemo(() => platform === "ios" && isIOSNonSafari(), [platform]);

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
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-5 py-10 sm:px-6 sm:py-12">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
            <IconDeviceMobile className="h-10 w-10" stroke={1.75} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-3xl">
            Instale o app Ankaa
          </h1>
          <p className="mt-3 max-w-md text-base text-muted-foreground">
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
            <div className="flex flex-col gap-6">
              {iosNeedsSafari ? <SafariRequiredBanner /> : null}
              <PlatformActions
                icon={<IconBrandApple className="h-7 w-7" stroke={1.75} />}
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
            </div>
          ) : platform === "android" ? (
            <PlatformActions
              icon={<IconBrandAndroid className="h-7 w-7" stroke={1.75} />}
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
                  <div className="space-y-2 text-base text-muted-foreground">
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

        <p className="mt-8 text-center text-sm text-muted-foreground">
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
    <div className="flex flex-col gap-7">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-foreground">
          {icon}
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{title}</p>
          <VersionLine build={build} loading={loading} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Primary: install/download */}
        {primaryDisabled ? (
          <Button size="lg" className="h-14 w-full text-base font-semibold" disabled>
            {primaryIcon}
            {primaryLabel}
          </Button>
        ) : (
          <Button asChild size="lg" className="h-14 w-full text-base font-semibold">
            <a href={primaryHref} {...(primaryDownload ? { download: true } : {})}>
              {primaryIcon}
              {primaryLabel}
            </a>
          </Button>
        )}
        {primaryDisabled ? (
          <p className="text-center text-sm text-muted-foreground">
            Esta versão ainda não está disponível para download.
          </p>
        ) : null}

        {/* Secondary: open the already-installed app */}
        <Button variant="outline" size="lg" className="h-14 w-full text-base" onClick={onOpenApp}>
          <IconExternalLink className="h-5 w-5" />
          Abrir o app
        </Button>
        {appOpenFailed ? (
          <p className="text-center text-sm text-muted-foreground">
            Não conseguimos abrir o app. Use o botão acima para instalá-lo primeiro.
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          "flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground",
        )}
      >
        <IconInfoCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <span>{note}</span>
      </div>
    </div>
  );
}

export default InstallPage;
