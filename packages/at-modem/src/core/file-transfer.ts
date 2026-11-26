// Module file system transfer over AT (A7670 series): AT+CFTRANRX (upload) / AT+CFTRANTX (download).
// The data does not follow the line protocol, so this works on raw serial bytes.
import type { AtClient } from './at-client.js';
import type { SerialTransport } from '../transport/serial-transport.js';

/** One CFTRANRX call is rejected by the firmware at ~32KB, so data is sent in smaller chunks. */
export const UPLOAD_CHUNK_BYTES = 16000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class FileTransfer {
  constructor(
    private client: AtClient,
    private transport: SerialTransport,
  ) {}

  /** Delete a file on the module; a missing file is not an error. */
  async delete(modulePath: string): Promise<void> {
    await this.client.sendCommand(`AT+FSDEL="${modulePath}"`, 5000).catch(() => undefined);
  }

  async upload(modulePath: string, data: Buffer): Promise<void> {
    await this.delete(modulePath);
    await this.client.runExclusive(async () => {
      let raw = '';
      const onRaw = (chunk: Buffer) => {
        raw += chunk.toString('latin1');
      };
      const waitRaw = async (re: RegExp, timeoutMs: number, what: string) => {
        const end = Date.now() + timeoutMs;
        while (Date.now() < end) {
          if (re.test(raw)) return;
          await sleep(10);
        }
        throw new Error(`Timeout waiting for ${what} (raw: ${JSON.stringify(raw.slice(-80))})`);
      };
      this.transport.on('raw', onRaw);
      try {
        for (let offset = 0; offset < data.length; offset += UPLOAD_CHUNK_BYTES) {
          const chunk = data.subarray(offset, offset + UPLOAD_CHUNK_BYTES);
          raw = '';
          await this.transport.write(`AT+CFTRANRX="${modulePath}",${chunk.length},100,${offset}`);
          // The prompt is CRLF + ">" with no trailing newline, so the line parser never sees it.
          await waitRaw(/\r\n>/, 5000, 'upload prompt ">"');
          raw = '';
          await this.transport.writeRaw(chunk);
          await waitRaw(/OK\r\n|ERROR/, 30000, 'upload completion');
          if (/ERROR/.test(raw)) {
            throw new Error(`CFTRANRX failed at offset ${offset} (raw: ${JSON.stringify(raw.slice(-120))})`);
          }
        }
      } finally {
        this.transport.off('raw', onRaw);
      }
    });
  }

  async download(modulePath: string): Promise<Buffer> {
    let raw = Buffer.alloc(0);
    const onRaw = (chunk: Buffer) => {
      raw = Buffer.concat([raw, chunk]);
    };
    this.transport.on('raw', onRaw);
    try {
      const r = await this.client.sendCommand(`AT+CFTRANTX="${modulePath}"`, 60000);
      if (!r.success) throw new Error(`CFTRANTX failed: ${r.result}`);
      // The trailing "+CFTRANTX: 0" can still be in flight when OK is seen.
      for (let i = 0; i < 20; i++) {
        const body = parseCftranTx(raw);
        if (body) return body;
        await sleep(50);
      }
    } finally {
      this.transport.off('raw', onRaw);
    }
    throw new Error(`Could not parse CFTRANTX output (${raw.length} bytes)`);
  }
}

/** Extract the payload from `+CFTRANTX: DATA,<len>\r\n<bytes>\r\n... +CFTRANTX: 0`. Null if incomplete. */
export function parseCftranTx(buf: Buffer): Buffer | null {
  const chunks: Buffer[] = [];
  let pos = 0;
  for (;;) {
    const marker = buf.indexOf('+CFTRANTX: ', pos, 'latin1');
    if (marker < 0) return null;
    const lineEnd = buf.indexOf('\r\n', marker, 'latin1');
    if (lineEnd < 0) return null;
    const header = buf.toString('latin1', marker, lineEnd);
    if (/^\+CFTRANTX: 0\s*$/.test(header)) return Buffer.concat(chunks);
    const m = header.match(/^\+CFTRANTX: DATA,\s*(\d+)/);
    if (!m) return null;
    const len = Number(m[1]);
    const start = lineEnd + 2;
    if (buf.length < start + len) return null;
    chunks.push(buf.subarray(start, start + len));
    pos = start + len;
  }
}
