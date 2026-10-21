// Modem port discovery for A7670C USB dongles
import { SerialPort } from 'serialport';

export interface UsbFilter {
  vendorId: string;
  productId: string;
}

export interface PortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

// Default SIMCom A7670C USB VID:PID pairs
const DEFAULT_FILTERS: UsbFilter[] = [
  { vendorId: '1e0e', productId: '9011' },
  { vendorId: '1e0e', productId: '9001' },
];

export async function listPorts(): Promise<PortInfo[]> {
  const ports = await SerialPort.list();
  return ports.map((p) => ({
    path: p.path,
    manufacturer: p.manufacturer,
    serialNumber: p.serialNumber,
    vendorId: p.vendorId,
    productId: p.productId,
  }));
}

export async function findModemPorts(filters: UsbFilter[] = DEFAULT_FILTERS): Promise<PortInfo[]> {
  const ports = await listPorts();
  const matches: PortInfo[] = [];

  for (const port of ports) {
    if (!port.vendorId || !port.productId) continue;

    const vid = port.vendorId.toLowerCase();
    const pid = port.productId.toLowerCase();

    for (const filter of filters) {
      if (vid === filter.vendorId.toLowerCase() && pid === filter.productId.toLowerCase()) {
        matches.push(port);
        break;
      }
    }
  }

  return matches;
}

export async function detectAtPort(
  candidatePorts: PortInfo[],
  baudRate = 115200,
): Promise<string | null> {
  // A7670C typically exposes multiple USB CDC ACM ports:
  // - ttyUSB0/COM3: diagnostics
  // - ttyUSB1/COM4: NMEA/GPS
  // - ttyUSB2/COM5: AT commands (primary)
  // - ttyUSB3/COM6: AT commands (secondary) or audio
  //
  // On Windows: COM3, COM4, COM5, COM6 (order varies)
  //
  // Strategy: try each port with AT command and check for OK response

  for (const portInfo of candidatePorts) {
    try {
      const result = await testAtCommand(portInfo.path, baudRate);
      if (result) {
        return portInfo.path;
      }
    } catch {
      // Try next port
    }
  }

  return null;
}

async function testAtCommand(path: string, baudRate: number): Promise<boolean> {
  return new Promise((resolve) => {
    const port = new SerialPort({ path, baudRate, autoOpen: false }, () => {});

    let responded = false;

    const timeout = setTimeout(() => {
      port.close();
      resolve(false);
    }, 2000);

    port.on('data', (data) => {
      const str = data.toString();
      if (str.includes('OK')) {
        responded = true;
        clearTimeout(timeout);
        port.close();
        resolve(true);
      }
    });

    port.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });

    port.open((err) => {
      if (err) {
        clearTimeout(timeout);
        resolve(false);
        return;
      }

      // Send AT command
      port.write('AT\r', (writeErr) => {
        if (writeErr) {
          clearTimeout(timeout);
          port.close();
          resolve(false);
        }
      });
    });
  });
}

export async function autoDetectModem(baudRate = 115200): Promise<string | null> {
  const modems = await findModemPorts();

  if (modems.length === 0) {
    return null;
  }

  return detectAtPort(modems, baudRate);
}
