// Shared helpers for the dial-test / answer-test verification scripts.
// Audio is handled on the module side (A7670G has no CPCMREG / USB audio):
//   upload  : AT+CFTRANRX  -> C:/sample.wav
//   play    : AT+CCMXPLAY=...,1,0  (remote path, needs an active voice call)
//   record  : AT+CREC=2,... (remote voice)  /  AT+CREC=0 to stop
//   download: AT+CFTRANTX
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AtClient,
  CallManager,
  CallState,
  SerialTransport,
  autoDetectModem,
} from '@at-gateway/at-modem';

export const SAMPLE_WAV = fileURLToPath(new URL('./sample-3s-8khz.wav', import.meta.url));
export const OUTPUT_DIR = fileURLToPath(new URL('./output/', import.meta.url));
export const MODULE_SAMPLE = 'C:/vt_sample.wav';
export const MODULE_REC = 'C:/vt_rec.wav';
const UPLOAD_CHUNK = 16000;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
export const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

/** Open the modem AT port. Uses MODEM_PORT, otherwise auto-detects. */
export async function openModem() {
  let port = process.env.MODEM_PORT;
  if (!port) {
    port = await autoDetectModem(115200);
    if (!port) {
      throw new Error(
        'No modem AT port found. Set MODEM_PORT (e.g. COM5). If the API (pnpm dev) is running it holds the port: stop it first.',
      );
    }
  }
  const transport = new SerialTransport({ path: port, baudRate: 115200 });
  const client = new AtClient({ transport, commandTimeout: 10000, debug: !!process.env.AT_DEBUG });
  client.on('error', (e) => log('[client error]', e.message));
  try {
    await client.open();
  } catch (e) {
    throw new Error(
      `Cannot open ${port}: ${e.message}. The port is probably in use (stop the API service / other serial tools first).`,
    );
  }
  const manager = new CallManager(client);
  await manager.initialize();
  log(`Modem opened on ${port}`);
  return { client, transport, manager, port };
}

export async function at(client, cmd, timeout = 10000) {
  const r = await client.sendCommand(cmd, timeout);
  log(`${cmd} -> ${r.result}${r.lines.length ? ' ' + JSON.stringify(r.lines.slice(-3)) : ''}`);
  return r;
}

/** Resolve when a URC line satisfies `pred`, reject on timeout. */
export function waitForUrc(client, pred, timeoutMs, what = 'URC') {
  return new Promise((resolve, reject) => {
    const onUrc = (line) => {
      if (pred(line)) {
        cleanup();
        resolve(line);
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for ${what}`));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      client.off('urc', onUrc);
    };
    client.on('urc', onUrc);
  });
}

/** Basic sanity check of the SIM / network before doing anything. */
export async function checkModemReady(client) {
  const pin = await at(client, 'AT+CPIN?');
  if (!pin.lines.some((l) => l.includes('READY'))) throw new Error('SIM not ready');
  // NB: AT+CREG? replies are swallowed by AtClient (treated as URC), so use COPS instead.
  const cops = await at(client, 'AT+COPS?');
  if (!cops.lines.some((l) => /\+COPS: \d,\d,/.test(l))) throw new Error('Not registered on a network');
  await at(client, 'AT+CSQ');
}

// ---------------------------------------------------------------- file transfer

/** Raw SerialPort behind the transport (needed for binary data; the transport only does text lines). */
const rawPort = (transport) => {
  if (!transport.port) throw new Error('transport has no raw port');
  return transport.port;
};

export async function deleteModuleFile(client, file) {
  await client.sendCommand(`AT+FSDEL="${file}"`, 5000).catch(() => undefined);
}

/**
 * Upload a file with AT+CFTRANRX. The modem's prompt is CRLF + ">" with no trailing newline, so
 * AtClient's line parser never reports it (expectPrompt would time out). We watch the raw bytes
 * instead and bypass the command queue (the queue is idle, so replies just surface as URC lines).
 */
export async function uploadFile(client, transport, localPath, modulePath) {
  const data = fs.readFileSync(localPath);
  await deleteModuleFile(client, modulePath);
  const port = rawPort(transport);
  let raw = '';
  const onData = (d) => {
    raw += d.toString('latin1');
  };
  const waitRaw = async (re, timeoutMs, what) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (re.test(raw)) return;
      await sleep(25);
    }
    throw new Error(`Timeout waiting for ${what} (raw: ${JSON.stringify(raw.slice(-80))})`);
  };
  port.on('data', onData);
  try {
    // A single transfer of >= ~32KB is rejected on this firmware (20KB works), so send chunks with a file offset.
    for (let offset = 0; offset < data.length; offset += UPLOAD_CHUNK) {
      const chunk = data.subarray(offset, offset + UPLOAD_CHUNK);
      raw = '';
      await transport.write(`AT+CFTRANRX="${modulePath}",${chunk.length},100,${offset}`);
      await waitRaw(/\r\n>/, 5000, 'upload prompt ">"');
      raw = '';
      await new Promise((res, rej) => port.write(chunk, (e) => (e ? rej(e) : res())));
      await waitRaw(/OK\r\n|ERROR/, 30000, 'upload completion');
      if (/ERROR/.test(raw)) throw new Error(`CFTRANRX failed at offset ${offset} (raw: ${JSON.stringify(raw.slice(-120))})`);
    }
  } finally {
    port.off('data', onData);
  }
  log(`uploaded ${data.length} bytes -> ${modulePath}`);
}

/** Pull `+CFTRANTX: DATA,<len>` chunks out of the raw byte stream. Returns null when incomplete. */
export function parseCftranTx(buf) {
  const chunks = [];
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

export async function downloadFile(client, transport, modulePath, localPath) {
  const port = rawPort(transport);
  let raw = Buffer.alloc(0);
  const onData = (d) => {
    raw = Buffer.concat([raw, d]);
  };
  port.on('data', onData);
  try {
    const r = await client.sendCommand(`AT+CFTRANTX="${modulePath}"`, 60000);
    await sleep(300);
    if (!r.success) throw new Error(`CFTRANTX failed: ${r.result}`);
  } finally {
    port.off('data', onData);
  }
  const body = parseCftranTx(raw);
  if (!body) {
    const dump = localPath + '.rawdump';
    fs.writeFileSync(dump, raw);
    throw new Error(`Could not parse CFTRANTX output (${raw.length} bytes, dumped to ${dump})`);
  }
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, body);
  log(`downloaded ${body.length} bytes -> ${localPath}`);
  return body;
}

export function describeWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return { ok: false, reason: `not a RIFF/WAVE file (first bytes: ${buf.subarray(0, 8).toString('hex')})` };
  }
  let pos = 12;
  let fmt = null;
  let dataBytes = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(pos + 8),
        channels: buf.readUInt16LE(pos + 10),
        sampleRate: buf.readUInt32LE(pos + 12),
        bits: buf.readUInt16LE(pos + 22),
      };
    } else if (id === 'data') {
      // streaming recorders often leave a bogus size; clamp to what we have
      dataBytes = Math.min(size, buf.length - (pos + 8));
      break;
    }
    pos += 8 + size + (size % 2);
  }
  if (!fmt) return { ok: false, reason: 'no fmt chunk' };
  const seconds = dataBytes / (fmt.sampleRate * fmt.channels * (fmt.bits / 8));
  const ok = fmt.format === 1 && fmt.channels === 1 && fmt.sampleRate === 8000 && fmt.bits === 16;
  return { ok, ...fmt, dataBytes, seconds: Number(seconds.toFixed(2)) };
}

// ---------------------------------------------------------------- call control

export async function listCalls(manager) {
  return manager.getCallStatus();
}

/** Poll AT+CLCC until `pred(calls)` holds. */
export async function waitForCalls(manager, pred, timeoutMs, what) {
  const end = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < end) {
    last = await listCalls(manager);
    if (pred(last)) return last;
    await sleep(500);
  }
  throw new Error(`Timeout waiting for ${what} (last CLCC: ${JSON.stringify(last)})`);
}

/** Hang up and confirm. at-modem's hangup() uses ATH, which is ignored when AT+CVHU=1, so fall back to AT+CHUP. */
export async function hangupAndVerify(client, manager) {
  try {
    await manager.hangup();
  } catch (e) {
    log('manager.hangup() threw:', e.message);
  }
  await sleep(1000);
  let calls = await listCalls(manager);
  if (calls.length > 0) {
    log('WARN: ATH did not end the call (CVHU?) -> using AT+CHUP');
    await client.sendCommand('AT+CHUP', 5000).catch((e) => log('CHUP failed:', e.message));
    await sleep(1000);
    calls = await listCalls(manager);
  }
  if (calls.length > 0) log('WARN: call still listed after hangup:', JSON.stringify(calls));
  return calls.length === 0;
}

/**
 * With an active call: record remote voice, play the sample to the remote party, keep recording
 * until the call ends (or `recordSeconds` elapse), then fetch the recording to output/.
 */
export async function runAudioSession({ client, transport, manager }, { label, recordSeconds }) {
  await deleteModuleFile(client, MODULE_REC);

  // This firmware rejects AT+CCMXPLAY (ERROR) while AT+CREC is recording, so play first, then record.
  const stopped = waitForUrc(client, (l) => l.includes('audio play stop'), 30000, 'end of playback');
  stopped.catch(() => undefined);
  const play = await at(client, `AT+CCMXPLAY="${MODULE_SAMPLE}",1,0`, 15000);
  if (!play.success) throw new Error(`AT+CCMXPLAY failed: ${play.result}`);
  await stopped;
  log('sample played to remote party');

  const rec = await at(client, `AT+CREC=2,"${MODULE_REC}"`);
  if (!rec.success) throw new Error(`AT+CREC failed to start: ${rec.result}`);

  log(`recording remote voice for up to ${recordSeconds}s (or until the other side hangs up)...`);
  const end = Date.now() + recordSeconds * 1000;
  let callEnded = false;
  while (Date.now() < end) {
    await sleep(1000);
    const calls = await listCalls(manager);
    if (!calls.some((c) => c.state === CallState.ACTIVE)) {
      callEnded = true;
      log('call ended by remote party');
      break;
    }
  }

  const stop = await at(client, 'AT+CREC=0');
  await sleep(500);
  if (!callEnded) await hangupAndVerify(client, manager);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const out = path.join(OUTPUT_DIR, `${label}-${stamp()}-remote.wav`);
  let info = null;
  if (stop.success) {
    const buf = await downloadFile(client, transport, MODULE_REC, out);
    info = describeWav(buf);
    log('recording format:', JSON.stringify(info));
    if (!info.ok) log('WARN: recording is not 8kHz/16bit/mono PCM WAV');
  }
  await deleteModuleFile(client, MODULE_REC);
  return { file: out, info };
}

export function installShutdown(ctx) {
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    log('Interrupted, cleaning up...');
    try {
      await ctx.client.sendCommand('AT+CREC=0', 3000).catch(() => undefined);
      await ctx.client.sendCommand('AT+CHUP', 3000).catch(() => undefined);
      await ctx.client.close();
    } finally {
      process.exit(130);
    }
  };
  process.on('SIGINT', shutdown);
}
