import { useCallback, useEffect, useRef, useState } from "react";
import { ImageEncoder, Utils } from "@mmote/niimbluelib";
import { useAuth } from "@/contexts/auth-context";
import { getLocalStorage, setLocalStorage } from "@/lib/storage";
import { apiClient } from "@/api-client/axiosClient";
import { ReconnectableNiimbotSerialClient } from "@/lib/printer/niimbot-reconnectable-client";
import { drawDuplaLabel, drawComboLabel, NIIMBOT_PRINT_DIRECTION } from "@/lib/printer/label-canvas";
import { LAST_LABEL_FORMAT_STORAGE_KEY, LAST_PRINTER_PORT_STORAGE_KEY } from "@/lib/printer/label-format";
import type { LabelFormat, StoredPrinterPort } from "@/lib/printer/label-format";
import { getFormatForBarcode, rememberBarcodeFormat } from "@/lib/printer/label-roll-memory";

export interface PrintablePaint {
  name: string;
  paintType?: { name: string } | null;
}

/** What the RFID tag of the currently loaded roll reports, plus the format we've learned for it. */
export interface LoadedLabelRoll {
  barCode: string;
  serialNumber: string;
  /** Labels left on the roll, or null when the printer doesn't report a total. */
  remaining: number | null;
  total: number | null;
  /** Format previously printed on a roll with this barcode — null the first time this SKU is seen. */
  detectedFormat: LabelFormat | null;
}

/** All state and logic for the Niimbot printer connection — the provider just wires this to context + renders the dialog. */
export function usePrinterClient() {
  const { user } = useAuth();
  const clientRef = useRef<ReconnectableNiimbotSerialClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new ReconnectableNiimbotSerialClient();
  }
  const client = clientRef.current;

  const [connected, setConnected] = useState(false);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [labelRoll, setLabelRoll] = useState<LoadedLabelRoll | null>(null);
  const [isReadingRoll, setIsReadingRoll] = useState(false);
  const isSerialSupported = typeof navigator !== "undefined" && "serial" in navigator;

  useEffect(() => {
    const onConnect = (event: { info?: { deviceName?: string } }) => {
      setConnected(true);
      setPrinterName(event?.info?.deviceName ?? null);
    };
    const onDisconnect = () => {
      setConnected(false);
      setPrinterName(null);
      setLabelRoll(null);
    };
    client.on("connect", onConnect);
    client.on("disconnect", onDisconnect);
    return () => {
      client.off("connect", onConnect);
      client.off("disconnect", onDisconnect);
    };
  }, [client]);

  // Auto-reconnect once, silently, after the user is authenticated — a
  // disconnected/powered-off printer is a normal state here, never an error.
  useEffect(() => {
    if (!user || !isSerialSupported) return;
    let cancelled = false;

    (async () => {
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length === 0 || cancelled) return;

        const stored = getLocalStorage(LAST_PRINTER_PORT_STORAGE_KEY);
        const storedInfo: StoredPrinterPort | null = stored ? JSON.parse(stored) : null;

        const match = storedInfo
          ? ports.find((port) => {
              const info = port.getInfo();
              return info.usbVendorId === storedInfo.usbVendorId && info.usbProductId === storedInfo.usbProductId;
            })
          : ports.length === 1
            ? ports[0]
            : undefined;

        if (!match || cancelled) return;
        await client.reconnectSilently(match);
      } catch (error) {
        console.warn("[printer] reconexão automática não disponível", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, user, isSerialSupported]);

  /** Must only ever be called from a real click handler — it triggers the OS device picker, which requires a user gesture. */
  const connectManually = useCallback(async () => {
    setIsConnecting(true);
    try {
      await client.connect();
      const port = client.getUnderlyingPort();
      if (port) {
        const info = port.getInfo();
        const toStore: StoredPrinterPort = { usbVendorId: info.usbVendorId, usbProductId: info.usbProductId };
        setLocalStorage(LAST_PRINTER_PORT_STORAGE_KEY, JSON.stringify(toStore));
      }
    } finally {
      setIsConnecting(false);
    }
  }, [client]);

  /**
   * Reads the RFID tag of the loaded roll to identify which consumable is in
   * the printer. Never throws: a roll without a tag, a printer that doesn't
   * answer the command, or an open lid are all normal states that simply mean
   * "unknown roll" and fall back to the manual format picker.
   */
  const readLabelRoll = useCallback(async (): Promise<LoadedLabelRoll | null> => {
    if (!connected) return null;
    setIsReadingRoll(true);
    try {
      const info = await client.abstraction.rfidInfo();
      if (!info.tagPresent || !info.barCode) {
        setLabelRoll(null);
        return null;
      }
      const roll: LoadedLabelRoll = {
        barCode: info.barCode,
        serialNumber: info.serialNumber,
        total: info.allPaper >= 0 ? info.allPaper : null,
        remaining: info.allPaper >= 0 && info.usedPaper >= 0 ? Math.max(info.allPaper - info.usedPaper, 0) : null,
        detectedFormat: getFormatForBarcode(info.barCode),
      };
      setLabelRoll(roll);
      return roll;
    } catch (error) {
      console.warn("[printer] não foi possível ler a etiqueta RFID do rolo", error);
      setLabelRoll(null);
      return null;
    } finally {
      setIsReadingRoll(false);
    }
  }, [client, connected]);

  const printLabel = useCallback(
    async (format: LabelFormat, paint: PrintablePaint) => {
      if (!connected) throw new Error("Impressora não conectada");

      const paintTypeName = paint.paintType?.name || "—";

      // Diagnostic trail for this one print attempt only — attached right
      // before printing, detached right after, so it never accumulates
      // across unrelated prints. Sent to the API so failures can be read
      // server-side instead of asking the user to screenshot their console.
      const packets: { dir: "sent" | "received"; command: number; hex: string }[] = [];
      const onPacketSent = (e: { packet: { command: number; toBytes: () => Uint8Array } }) => {
        packets.push({ dir: "sent", command: e.packet.command, hex: Utils.bufToHex(e.packet.toBytes()) });
      };
      const onPacketReceived = (e: { packet: { command: number; toBytes: () => Uint8Array } }) => {
        packets.push({ dir: "received", command: e.packet.command, hex: Utils.bufToHex(e.packet.toBytes()) });
      };
      client.on("packetsent", onPacketSent);
      client.on("packetreceived", onPacketReceived);

      const canvas = format === "DUPLA" ? drawDuplaLabel(paintTypeName, paint.name) : drawComboLabel(paint.name, paintTypeName);
      const baseLog = {
        feature: "niimbot-label-print",
        format,
        printerName,
        direction: NIIMBOT_PRINT_DIRECTION,
        canvas: { width: canvas.width, height: canvas.height },
        paintName: paint.name,
        paintTypeName,
        // Logged so the barcode↔format pairings can be read server-side and
        // seeded for other machines, instead of each browser learning alone.
        roll: labelRoll,
      };

      try {
        const printTask = client.abstraction.newPrintTask("B1", {
          totalPages: 1,
          statusPollIntervalMs: 100,
          statusTimeoutMs: 8000,
        });

        try {
          await printTask.printInit();
          await printTask.printPage(ImageEncoder.encodeCanvas(canvas, NIIMBOT_PRINT_DIRECTION), 1);
          await printTask.waitForPageFinished();
          await printTask.waitForFinished();
        } finally {
          await printTask.printEnd();
        }

        setLocalStorage(LAST_LABEL_FORMAT_STORAGE_KEY, format);
        // A print that went through is the ground truth for "this roll is this
        // size", so it's what teaches the barcode→format map.
        if (labelRoll) {
          rememberBarcodeFormat(labelRoll.barCode, format);
          setLabelRoll({ ...labelRoll, detectedFormat: format });
        }
        // Success: just the summary, not the full packet trace — keeps routine prints lightweight.
        void apiClient.post("/printer-log", { ...baseLog, success: true }).catch(() => {});
      } catch (error) {
        // Failure: include the full packet trace, since this is exactly the case worth digging into later.
        void apiClient
          .post("/printer-log", {
            ...baseLog,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            packets,
          })
          .catch(() => {});
        throw error;
      } finally {
        client.off("packetsent", onPacketSent);
        client.off("packetreceived", onPacketReceived);
      }
    },
    [client, connected, printerName, labelRoll],
  );

  return { connected, printerName, isConnecting, isSerialSupported, connectManually, printLabel, labelRoll, isReadingRoll, readLabelRoll };
}
