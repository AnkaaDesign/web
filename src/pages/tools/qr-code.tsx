import { useEffect, useMemo, useState } from "react";
import { type QRCodeErrorCorrectionLevel } from "qrcode";
import {
  IconQrcode,
  IconDownload,
  IconLink,
  IconPhone,
  IconMessage,
  IconMail,
  IconWifi,
  IconUserCircle,
  IconMapPin,
  IconLetterCase,
} from "@tabler/icons-react";
import type { Icon as TablerIcon } from "@tabler/icons-react";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { routes } from "@/constants";
import { cn } from "@/lib/utils";

import {
  encodeQrPayload,
  type QrContentType,
  type QrInput,
} from "@/utils/qr-code-encoders";
import {
  buildCutOptimizedSvg,
  generateQrVector,
} from "@/utils/qr-code-vector";

const CONTENT_TYPES: { value: QrContentType; label: string; icon: TablerIcon }[] = [
  { value: "url", label: "Site", icon: IconLink },
  { value: "text", label: "Texto", icon: IconLetterCase },
  { value: "phone", label: "Telefone", icon: IconPhone },
  { value: "sms", label: "SMS", icon: IconMessage },
  { value: "email", label: "E-mail", icon: IconMail },
  { value: "wifi", label: "Wi-Fi", icon: IconWifi },
  { value: "vcard", label: "Contato", icon: IconUserCircle },
  { value: "geo", label: "Localização", icon: IconMapPin },
];

const ERROR_CORRECTION_OPTIONS = [
  { value: "L", label: "Baixa (~7%)", description: "QR mais enxuto, ideal para corte" },
  { value: "M", label: "Média (~15%)", description: "Equilíbrio entre tamanho e robustez" },
  { value: "Q", label: "Alta (~25%)", description: "Resistente a sujeira e desgaste" },
  { value: "H", label: "Máxima (~30%)", description: "Máxima tolerância a danos" },
];

interface FormState {
  type: QrContentType;
  text: string;
  url: string;
  phone: string;
  smsPhone: string;
  smsMessage: string;
  email: string;
  emailSubject: string;
  emailBody: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiEncryption: "WPA" | "WEP" | "nopass";
  wifiHidden: boolean;
  vcardFirstName: string;
  vcardLastName: string;
  vcardOrganization: string;
  vcardTitle: string;
  vcardPhone: string;
  vcardEmail: string;
  vcardUrl: string;
  vcardAddress: string;
  geoLatitude: string;
  geoLongitude: string;
}

const INITIAL_STATE: FormState = {
  type: "url",
  text: "",
  url: "https://ankaadesign.com.br",
  phone: "",
  smsPhone: "",
  smsMessage: "",
  email: "",
  emailSubject: "",
  emailBody: "",
  wifiSsid: "",
  wifiPassword: "",
  wifiEncryption: "WPA",
  wifiHidden: false,
  vcardFirstName: "",
  vcardLastName: "",
  vcardOrganization: "",
  vcardTitle: "",
  vcardPhone: "",
  vcardEmail: "",
  vcardUrl: "",
  vcardAddress: "",
  geoLatitude: "",
  geoLongitude: "",
};

const buildInput = (s: FormState): QrInput => {
  switch (s.type) {
    case "text":
      return { type: "text", data: { text: s.text } };
    case "url":
      return { type: "url", data: { url: s.url } };
    case "phone":
      return { type: "phone", data: { phone: s.phone } };
    case "sms":
      return { type: "sms", data: { phone: s.smsPhone, message: s.smsMessage } };
    case "email":
      return { type: "email", data: { email: s.email, subject: s.emailSubject, body: s.emailBody } };
    case "wifi":
      return {
        type: "wifi",
        data: { ssid: s.wifiSsid, password: s.wifiPassword, encryption: s.wifiEncryption, hidden: s.wifiHidden },
      };
    case "vcard":
      return {
        type: "vcard",
        data: {
          firstName: s.vcardFirstName,
          lastName: s.vcardLastName,
          organization: s.vcardOrganization,
          title: s.vcardTitle,
          phone: s.vcardPhone,
          email: s.vcardEmail,
          url: s.vcardUrl,
          address: s.vcardAddress,
        },
      };
    case "geo":
      return { type: "geo", data: { latitude: s.geoLatitude, longitude: s.geoLongitude } };
  }
};

const sanitizeFileName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40) || "qr-code";

// Adapt the custom Input's (value) => void signature to a string setter.
const asText = (value: string | number | null): string => {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
};

export function QrCodeToolPage() {
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [errorCorrection, setErrorCorrection] = useState<QRCodeErrorCorrectionLevel>("L");
  const [svgMarkup, setSvgMarkup] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [matrixSize, setMatrixSize] = useState<number>(0);
  const [pathCount, setPathCount] = useState<number>(0);

  const payload = useMemo(() => encodeQrPayload(buildInput(state)), [state]);

  useEffect(() => {
    if (!payload) {
      setSvgMarkup("");
      setError(null);
      setMatrixSize(0);
      setPathCount(0);
      return;
    }

    try {
      const { size, polygons } = generateQrVector(payload, errorCorrection);
      const svg = buildCutOptimizedSvg(polygons, size, 1);
      setSvgMarkup(svg);
      setError(null);
      setMatrixSize(size);
      setPathCount(polygons.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar QR Code");
      setSvgMarkup("");
      setMatrixSize(0);
      setPathCount(0);
    }
  }, [payload, errorCorrection]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const handleDownloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(payload)}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const version = matrixSize > 0 ? Math.floor((matrixSize - 17) / 4) : 0;

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Gerador de QR Code"
          icon={IconQrcode}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Ferramentas", href: routes.tools.root },
            { label: "QR Code" },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Form column */}
          <Card className="lg:col-span-3 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Conteúdo</CardTitle>
              <CardDescription>Selecione o tipo de informação que o QR Code irá codificar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Content type picker */}
              <div className="grid grid-cols-4 gap-2">
                {CONTENT_TYPES.map((ct) => {
                  const Icon = ct.icon;
                  const active = state.type === ct.value;
                  return (
                    <button
                      key={ct.value}
                      type="button"
                      onClick={() => setField("type", ct.value)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-md border px-2 py-3 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" stroke={1.5} />
                      <span>{ct.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic form fields per content type */}
              <div className="space-y-4">
                <ContentTypeFields state={state} setField={setField} />
              </div>

              {/* Advanced options */}
              <div className="border-t border-border pt-4 space-y-2">
                <Label htmlFor="qr-ec">Correção de erros</Label>
                <Combobox
                  value={errorCorrection}
                  onValueChange={(v) => setErrorCorrection(((v as string) ?? "L") as QRCodeErrorCorrectionLevel)}
                  options={ERROR_CORRECTION_OPTIONS}
                  searchable={false}
                  clearable={false}
                  placeholder="Selecione o nível de correção"
                />
                <p className="text-xs text-muted-foreground">
                  Nível Baixo (L) gera o QR mais enxuto, com menos caminhos de corte. Aumente apenas se o vinil estará exposto a desgaste.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preview column */}
          <Card className="lg:col-span-2 flex flex-col lg:sticky lg:top-4 self-start w-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <CardTitle className="text-lg">Pré-visualização</CardTitle>
                  <CardDescription>Atualizada conforme você digita</CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={handleDownloadSvg}
                  disabled={!svgMarkup}
                >
                  <IconDownload className="h-4 w-4" />
                  Baixar QR
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center bg-white rounded-lg border border-border aspect-square w-full max-w-[360px] mx-auto p-4">
                {error ? (
                  <p className="text-sm text-destructive text-center px-4">{error}</p>
                ) : svgMarkup ? (
                  <div
                    className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: svgMarkup }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground text-center px-4">
                    <IconQrcode className="h-12 w-12 opacity-30" stroke={1.5} />
                    <p className="text-sm">Preencha o conteúdo para gerar o QR Code</p>
                  </div>
                )}
              </div>

              {svgMarkup && matrixSize > 0 && (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-md bg-muted/40 px-2 py-2">
                    <p className="text-xs text-muted-foreground">Versão</p>
                    <p className="text-sm font-semibold">{version}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 px-2 py-2">
                    <p className="text-xs text-muted-foreground">Módulos</p>
                    <p className="text-sm font-semibold">{matrixSize}×{matrixSize}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 px-2 py-2">
                    <p className="text-xs text-muted-foreground">Caracteres</p>
                    <p className="text-sm font-semibold">{payload.length}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 px-2 py-2">
                    <p className="text-xs text-muted-foreground">Caminhos de corte</p>
                    <p className="text-sm font-semibold">{pathCount}</p>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Saída vetorial otimizada para corte: um caminho fechado por região, sem sobreposição de retângulos.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  state: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

function ContentTypeFields({ state, setField }: FieldProps) {
  switch (state.type) {
    case "text":
      return (
        <div className="space-y-2">
          <Label htmlFor="qr-text">Texto</Label>
          <Textarea
            id="qr-text"
            value={state.text}
            onChange={(e) => setField("text", e.target.value)}
            placeholder="Digite o texto que será codificado"
            rows={4}
          />
        </div>
      );

    case "url":
      return (
        <div className="space-y-2">
          <Label htmlFor="qr-url">URL do site</Label>
          <Input
            id="qr-url"
            type="text"
            value={state.url}
            onChange={(value) => setField("url", asText(value))}
            placeholder="exemplo.com.br"
          />
          <p className="text-xs text-muted-foreground">
            Se o esquema (https://) não for informado, será adicionado automaticamente.
          </p>
        </div>
      );

    case "phone":
      return (
        <div className="space-y-2">
          <Label htmlFor="qr-phone">Telefone (com DDI/DDD)</Label>
          <Input
            id="qr-phone"
            type="text"
            value={state.phone}
            onChange={(value) => setField("phone", asText(value))}
            placeholder="+55 11 99999-9999"
          />
        </div>
      );

    case "sms":
      return (
        <>
          <div className="space-y-2">
            <Label htmlFor="qr-sms-phone">Telefone</Label>
            <Input
              id="qr-sms-phone"
              type="text"
              value={state.smsPhone}
              onChange={(value) => setField("smsPhone", asText(value))}
              placeholder="+55 11 99999-9999"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qr-sms-message">Mensagem (opcional)</Label>
            <Textarea
              id="qr-sms-message"
              value={state.smsMessage}
              onChange={(e) => setField("smsMessage", e.target.value)}
              placeholder="Mensagem pré-preenchida"
              rows={3}
            />
          </div>
        </>
      );

    case "email":
      return (
        <>
          <div className="space-y-2">
            <Label htmlFor="qr-email">E-mail</Label>
            <Input
              id="qr-email"
              type="text"
              value={state.email}
              onChange={(value) => setField("email", asText(value))}
              placeholder="contato@exemplo.com.br"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qr-email-subject">Assunto (opcional)</Label>
              <Input
                id="qr-email-subject"
                type="text"
                value={state.emailSubject}
                onChange={(value) => setField("emailSubject", asText(value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-email-body">Mensagem (opcional)</Label>
              <Input
                id="qr-email-body"
                type="text"
                value={state.emailBody}
                onChange={(value) => setField("emailBody", asText(value))}
              />
            </div>
          </div>
        </>
      );

    case "wifi":
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qr-wifi-ssid">Nome da rede (SSID)</Label>
              <Input
                id="qr-wifi-ssid"
                type="text"
                value={state.wifiSsid}
                onChange={(value) => setField("wifiSsid", asText(value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-wifi-encryption">Criptografia</Label>
              <Select
                value={state.wifiEncryption}
                onValueChange={(v) => setField("wifiEncryption", v as FormState["wifiEncryption"])}
              >
                <SelectTrigger id="qr-wifi-encryption">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WPA">WPA / WPA2</SelectItem>
                  <SelectItem value="WEP">WEP</SelectItem>
                  <SelectItem value="nopass">Sem senha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {state.wifiEncryption !== "nopass" && (
            <div className="space-y-2">
              <Label htmlFor="qr-wifi-password">Senha</Label>
              <Input
                id="qr-wifi-password"
                type="text"
                value={state.wifiPassword}
                onChange={(value) => setField("wifiPassword", asText(value))}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox
              id="qr-wifi-hidden"
              checked={state.wifiHidden}
              onCheckedChange={(c) => setField("wifiHidden", Boolean(c))}
            />
            <Label htmlFor="qr-wifi-hidden">Rede oculta</Label>
          </div>
        </>
      );

    case "vcard":
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qr-vcard-first">Nome</Label>
              <Input
                id="qr-vcard-first"
                type="text"
                value={state.vcardFirstName}
                onChange={(value) => setField("vcardFirstName", asText(value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-vcard-last">Sobrenome</Label>
              <Input
                id="qr-vcard-last"
                type="text"
                value={state.vcardLastName}
                onChange={(value) => setField("vcardLastName", asText(value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qr-vcard-org">Empresa</Label>
              <Input
                id="qr-vcard-org"
                type="text"
                value={state.vcardOrganization}
                onChange={(value) => setField("vcardOrganization", asText(value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-vcard-title">Cargo</Label>
              <Input
                id="qr-vcard-title"
                type="text"
                value={state.vcardTitle}
                onChange={(value) => setField("vcardTitle", asText(value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qr-vcard-phone">Telefone</Label>
              <Input
                id="qr-vcard-phone"
                type="text"
                value={state.vcardPhone}
                onChange={(value) => setField("vcardPhone", asText(value))}
                placeholder="+55 11 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-vcard-email">E-mail</Label>
              <Input
                id="qr-vcard-email"
                type="text"
                value={state.vcardEmail}
                onChange={(value) => setField("vcardEmail", asText(value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qr-vcard-url">Site</Label>
            <Input
              id="qr-vcard-url"
              type="text"
              value={state.vcardUrl}
              onChange={(value) => setField("vcardUrl", asText(value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qr-vcard-address">Endereço</Label>
            <Input
              id="qr-vcard-address"
              type="text"
              value={state.vcardAddress}
              onChange={(value) => setField("vcardAddress", asText(value))}
            />
          </div>
        </>
      );

    case "geo":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="qr-geo-lat">Latitude</Label>
            <Input
              id="qr-geo-lat"
              type="text"
              value={state.geoLatitude}
              onChange={(value) => setField("geoLatitude", asText(value))}
              placeholder="-23.5505"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qr-geo-lng">Longitude</Label>
            <Input
              id="qr-geo-lng"
              type="text"
              value={state.geoLongitude}
              onChange={(value) => setField("geoLongitude", asText(value))}
              placeholder="-46.6333"
            />
          </div>
        </div>
      );
  }
}

export default QrCodeToolPage;
