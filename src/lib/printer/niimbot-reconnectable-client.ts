import { NiimbotSerialClient, ConnectEvent, DisconnectEvent, ConnectResult } from "@mmote/niimbluelib";
import type { ConnectionInfo } from "@mmote/niimbluelib";

/**
 * niimbluelib's public `connect()` always calls `navigator.serial.requestPort()`,
 * which always shows the OS device picker and requires a fresh user gesture —
 * there is no public API to silently reconnect to a port the browser already
 * granted access to in an earlier session.
 *
 * `reconnectSilently` replicates the body of `NiimbotSerialClient.connect()`
 * from niimbluelib 0.0.1-alpha.43 (see node_modules/@mmote/niimbluelib/dist/cjs/client/serial_impl.js),
 * verbatim, minus the `requestPort()` call — it takes an already-granted
 * `SerialPort` (from `navigator.serial.getPorts()`) instead.
 *
 * FRAGILE ON PURPOSE: `port`/`writer`/`reader`/`waitSerialData` are `private`
 * fields on the base class in its TypeScript declarations, but the compiled
 * JS uses plain `this.port = ...` assignments (no real `#private` fields), so
 * they're reachable at runtime via the `as any` casts below. If the pinned
 * niimbluelib version in package.json is ever bumped, re-diff
 * `serial_impl.js`'s `connect()` against this method before trusting it.
 */
export class ReconnectableNiimbotSerialClient extends NiimbotSerialClient {
  async reconnectSilently(port: SerialPort): Promise<ConnectionInfo> {
    await this.disconnect();

    const self = this as any;

    port.addEventListener("disconnect", () => {
      self.port = undefined;
      this.emit("disconnect", new DisconnectEvent());
    });

    await port.open({ baudRate: 115200 });

    if (port.readable === null) throw new Error("Port is not readable");
    if (port.writable === null) throw new Error("Port is not writable");

    self.port = port;
    self.writer = port.writable.getWriter();
    self.reader = port.readable.getReader();

    setTimeout(() => {
      void self.waitSerialData();
    }, 1);

    try {
      await self.initialNegotiate();
      await this.fetchPrinterInfo();
    } catch (e) {
      console.error("[printer] reconnectSilently: falha ao negociar/obter info da impressora", e);
    }

    const info: ConnectionInfo = {
      deviceName: `Serial (VID:${port.getInfo().usbVendorId?.toString(16)} PID:${port.getInfo().usbProductId?.toString(16)})`,
      result: self.info?.connectResult ?? ConnectResult.FirmwareErrors,
    };

    this.emit("connect", new ConnectEvent(info));
    return info;
  }

  /** Exposes the underlying SerialPort so callers can persist its vendor/product id after a manual connect. */
  getUnderlyingPort(): SerialPort | undefined {
    return (this as any).port;
  }
}
