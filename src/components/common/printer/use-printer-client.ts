import { useCallback, useEffect, useRef, useState } from "react";
import { ImageEncoder } from "@mmote/niimbluelib";
import { useAuth } from "@/contexts/auth-context";
import { getLocalStorage, setLocalStorage } from "@/lib/storage";
import { ReconnectableNiimbotSerialClient } from "@/lib/printer/niimbot-reconnectable-client";
import { drawDuplaLabels, drawComboLabel, NIIMBOT_PRINT_DIRECTION } from "@/lib/printer/label-canvas";
import { LAST_LABEL_FORMAT_STORAGE_KEY, LAST_PRINTER_PORT_STORAGE_KEY } from "@/lib/printer/label-format";
import type { LabelFormat, StoredPrinterPort } from "@/lib/printer/label-format";

export interface PrintablePaint {
  name: string;
  paintType?: { name: string } | null;
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
  const isSerialSupported = typeof navigator !== "undefined" && "serial" in navigator;

  useEffect(() => {
    const onConnect = (event: { info?: { deviceName?: string } }) => {
      setConnected(true);
      setPrinterName(event?.info?.deviceName ?? null);
    };
    const onDisconnect = () => {
      setConnected(false);
      setPrinterName(null);
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

  const printLabel = useCallback(
    async (format: LabelFormat, paint: PrintablePaint) => {
      if (!connected) throw new Error("Impressora não conectada");

      const paintTypeName = paint.paintType?.name || "—";
      const printTask = client.abstraction.newPrintTask("B1", {
        totalPages: format === "DUPLA" ? 2 : 1,
        statusPollIntervalMs: 100,
        statusTimeoutMs: 8000,
      });

      try {
        await printTask.printInit();
        if (format === "DUPLA") {
          const { typeCanvas, nameCanvas } = drawDuplaLabels(paintTypeName, paint.name);
          await printTask.printPage(ImageEncoder.encodeCanvas(typeCanvas, NIIMBOT_PRINT_DIRECTION), 1);
          await printTask.printPage(ImageEncoder.encodeCanvas(nameCanvas, NIIMBOT_PRINT_DIRECTION), 1);
        } else {
          const canvas = drawComboLabel(paint.name, paintTypeName);
          await printTask.printPage(ImageEncoder.encodeCanvas(canvas, NIIMBOT_PRINT_DIRECTION), 1);
        }
        await printTask.waitForPageFinished();
        await printTask.waitForFinished();
      } finally {
        await printTask.printEnd();
      }

      setLocalStorage(LAST_LABEL_FORMAT_STORAGE_KEY, format);
    },
    [client, connected],
  );

  return { connected, printerName, isConnecting, isSerialSupported, connectManually, printLabel };
}
