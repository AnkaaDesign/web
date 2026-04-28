// QR code content encoders.
//
// Each encoder takes a structured input and returns the most efficient
// payload string for that content type, following the conventions decoded by
// most modern smartphone cameras (matching the behavior of CorelDRAW's QR
// code tool). The `qrcode` library is then responsible for picking the most
// compact mode (numeric / alphanumeric / byte / kanji) and the smallest
// version that fits the payload.

export type QrContentType =
  | "text"
  | "url"
  | "phone"
  | "sms"
  | "email"
  | "wifi"
  | "vcard"
  | "geo";

export interface QrContentTypeOption {
  value: QrContentType;
  label: string;
  description: string;
}

export const QR_CONTENT_TYPES: QrContentTypeOption[] = [
  { value: "text", label: "Texto", description: "Texto livre" },
  { value: "url", label: "Site / URL", description: "Endereço de site" },
  { value: "phone", label: "Telefone", description: "Discar para um número" },
  { value: "sms", label: "SMS", description: "Mensagem de texto" },
  { value: "email", label: "E-mail", description: "Enviar e-mail" },
  { value: "wifi", label: "Wi-Fi", description: "Conectar a uma rede Wi-Fi" },
  { value: "vcard", label: "Cartão de Contato", description: "Compartilhar contato (vCard)" },
  { value: "geo", label: "Localização", description: "Coordenadas geográficas" },
];

const escapeWifi = (value: string): string =>
  value.replace(/([\\;,":])/g, "\\$1");

const escapeVcard = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

const stripPhoneFormatting = (phone: string): string =>
  phone.replace(/[^0-9+]/g, "");

export interface TextInput { text: string }
export interface UrlInput { url: string }
export interface PhoneInput { phone: string }
export interface SmsInput { phone: string; message?: string }
export interface EmailInput { email: string; subject?: string; body?: string }
export interface WifiInput {
  ssid: string;
  password?: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
}
export interface VCardInput {
  firstName?: string;
  lastName?: string;
  organization?: string;
  title?: string;
  phone?: string;
  email?: string;
  url?: string;
  address?: string;
}
export interface GeoInput { latitude: number | string; longitude: number | string }

export type QrInput =
  | { type: "text"; data: TextInput }
  | { type: "url"; data: UrlInput }
  | { type: "phone"; data: PhoneInput }
  | { type: "sms"; data: SmsInput }
  | { type: "email"; data: EmailInput }
  | { type: "wifi"; data: WifiInput }
  | { type: "vcard"; data: VCardInput }
  | { type: "geo"; data: GeoInput };

export const encodeQrPayload = (input: QrInput): string => {
  switch (input.type) {
    case "text":
      return input.data.text ?? "";

    case "url": {
      const raw = (input.data.url ?? "").trim();
      if (!raw) return "";
      // Add https:// if no scheme provided so the QR is recognized as a link
      return /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    }

    case "phone": {
      const phone = stripPhoneFormatting(input.data.phone ?? "");
      return phone ? `tel:${phone}` : "";
    }

    case "sms": {
      const phone = stripPhoneFormatting(input.data.phone ?? "");
      if (!phone) return "";
      const msg = input.data.message?.trim();
      return msg ? `SMSTO:${phone}:${msg}` : `sms:${phone}`;
    }

    case "email": {
      const email = (input.data.email ?? "").trim();
      if (!email) return "";
      const params: string[] = [];
      if (input.data.subject) params.push(`subject=${encodeURIComponent(input.data.subject)}`);
      if (input.data.body) params.push(`body=${encodeURIComponent(input.data.body)}`);
      return params.length ? `mailto:${email}?${params.join("&")}` : `mailto:${email}`;
    }

    case "wifi": {
      const { ssid, password, encryption, hidden } = input.data;
      if (!ssid) return "";
      const parts = [
        `T:${encryption}`,
        `S:${escapeWifi(ssid)}`,
        encryption !== "nopass" && password ? `P:${escapeWifi(password)}` : "",
        hidden ? "H:true" : "",
      ].filter(Boolean);
      return `WIFI:${parts.join(";")};;`;
    }

    case "vcard": {
      const d = input.data;
      const fullName = [d.firstName, d.lastName].filter(Boolean).join(" ").trim();
      if (!fullName && !d.organization && !d.phone && !d.email) return "";
      const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
      if (fullName) lines.push(`FN:${escapeVcard(fullName)}`);
      if (d.lastName || d.firstName) {
        lines.push(`N:${escapeVcard(d.lastName ?? "")};${escapeVcard(d.firstName ?? "")};;;`);
      }
      if (d.organization) lines.push(`ORG:${escapeVcard(d.organization)}`);
      if (d.title) lines.push(`TITLE:${escapeVcard(d.title)}`);
      if (d.phone) lines.push(`TEL:${stripPhoneFormatting(d.phone)}`);
      if (d.email) lines.push(`EMAIL:${escapeVcard(d.email)}`);
      if (d.url) lines.push(`URL:${escapeVcard(d.url)}`);
      if (d.address) lines.push(`ADR:;;${escapeVcard(d.address)};;;;`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }

    case "geo": {
      const lat = String(input.data.latitude ?? "").trim();
      const lng = String(input.data.longitude ?? "").trim();
      if (!lat || !lng) return "";
      return `geo:${lat},${lng}`;
    }
  }
};
