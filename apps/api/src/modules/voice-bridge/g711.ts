// G.711 μ-law <-> PCM16 and minimal WAV helpers for the module's 8kHz 16-bit mono audio.

const BIAS = 0x84;
const CLIP = 32635;

export function linearToMulaw(sample: number): number {
  let s = sample;
  const sign = s < 0 ? 0x80 : 0;
  if (s < 0) s = -s;
  if (s > CLIP) s = CLIP;
  s += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

export function mulawToLinear(byte: number): number {
  const u = ~byte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const magnitude = (((mantissa << 3) + BIAS) << exponent) - BIAS;
  return sign ? -magnitude : magnitude;
}

/** PCM16 little-endian -> μ-law bytes (one byte per sample). */
export function pcm16ToMulaw(pcm: Buffer): Buffer {
  const n = Math.floor(pcm.length / 2);
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) out[i] = linearToMulaw(pcm.readInt16LE(i * 2));
  return out;
}

/** μ-law bytes -> PCM16 little-endian. */
export function mulawToPcm16(mulaw: Buffer): Buffer {
  const out = Buffer.alloc(mulaw.length * 2);
  for (let i = 0; i < mulaw.length; i++) out.writeInt16LE(mulawToLinear(mulaw[i]!), i * 2);
  return out;
}

/** Wrap 8kHz 16-bit mono PCM into a WAV file. */
export function buildWav(pcm: Buffer, sampleRate = 8000): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Extract the PCM payload of a WAV file. Recorders that stream to a file may leave a bogus data size,
 * so the size is clamped to what is actually present. Returns null if the file is not a WAV.
 */
export function parseWavPcm(
  buf: Buffer,
): { pcm: Buffer; sampleRate: number; channels: number; bits: number } | null {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }
  let pos = 12;
  let fmt: { sampleRate: number; channels: number; bits: number } | null = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      fmt = {
        channels: buf.readUInt16LE(pos + 10),
        sampleRate: buf.readUInt32LE(pos + 12),
        bits: buf.readUInt16LE(pos + 22),
      };
    } else if (id === 'data') {
      if (!fmt) return null;
      const end = Math.min(pos + 8 + size, buf.length);
      return { pcm: buf.subarray(pos + 8, end), ...fmt };
    }
    pos += 8 + size + (size % 2);
  }
  return null;
}

/** Split into frames of `size` bytes; a short last frame is padded with μ-law silence (0xFF). */
export function toFrames(mulaw: Buffer, size = 160): Buffer[] {
  const frames: Buffer[] = [];
  for (let i = 0; i < mulaw.length; i += size) {
    const frame = mulaw.subarray(i, i + size);
    if (frame.length === size) frames.push(frame);
    else frames.push(Buffer.concat([frame, Buffer.alloc(size - frame.length, 0xff)]));
  }
  return frames;
}
