// Minimal Twilio-style application for hardware testing of the media stream bridge.
//   node apps/api/src/sample/stream-echo-app.mjs [--port 3100] [--host <public host:port>] [--mode echo|sample|clear|close]
// Modes: echo = send caller audio back; sample = play the sample + mark; clear = like sample, then send
// `clear` after 2.5s (mid-playback); close = like sample, then close the socket once the mark comes back (gateway must hang up).
// Endpoints (same shape as ai-voice-assistant-openai-deepgram):
//   POST /incoming     -> TwiML <Connect><Stream url="ws://<host>/connection"/></Connect>
//   WS   /connection   -> logs events; echoes the caller's audio back (echo) or plays the sample once (sample)
// Then set voice.incomingUrl to http://<this machine>:3100/incoming in the gateway settings and call the SIM.
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const PORT = Number(arg('port', '3100'));
const HOST = arg('host', `127.0.0.1:${PORT}`);
const MODE = arg('mode', 'echo');
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);

// μ-law encode a 16-bit PCM WAV (8kHz mono) for the "sample" mode.
function wavToMulaw(file) {
  const buf = fs.readFileSync(file);
  const pcm = buf.subarray(44);
  const out = Buffer.alloc(pcm.length >> 1);
  for (let i = 0; i < out.length; i++) {
    let s = pcm.readInt16LE(i * 2);
    const sign = s < 0 ? 0x80 : 0;
    if (s < 0) s = -s;
    if (s > 32635) s = 32635;
    s += 0x84;
    let e = 7;
    for (let m = 0x4000; (s & m) === 0 && e > 0; m >>= 1) e--;
    out[i] = ~(sign | (e << 4) | ((s >> (e + 3)) & 0x0f)) & 0xff;
  }
  return out;
}

// μ-law byte -> linear sample, for the loudness readout of incoming frames.
function mulawToLinear(byte) {
  const u = ~byte & 0xff;
  const mag = (((u & 0x0f) << 3) + 0x84) << ((u >> 4) & 0x07);
  return u & 0x80 ? 0x84 - mag : mag - 0x84;
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/incoming') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      log('POST /incoming', body);
      log('  signature:', req.headers['x-gateway-signature'], 'timestamp:', req.headers['x-gateway-timestamp']);
      res.setHeader('Content-Type', 'text/xml');
      res.end(`<Response><Connect><Stream url="ws://${HOST}/connection"/></Connect></Response>`);
    });
    return;
  }
  res.statusCode = 404;
  res.end();
});

const wss = new WebSocketServer({ server, path: '/connection' });
wss.on('connection', (ws) => {
  log('WS connected');
  let streamSid = '';
  let media = 0;
  let sumSq = 0;
  let samples = 0;
  let peak = 0;
  let sampleSent = false;
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.event === 'media') {
      media++;
      const frame = Buffer.from(msg.media.payload, 'base64');
      for (const b of frame) {
        const v = mulawToLinear(b);
        sumSq += v * v;
        samples++;
        peak = Math.max(peak, Math.abs(v));
      }
      if (media === 1 || media % 50 === 0) {
        log(`media #${media}: last ${samples} samples rms=${Math.round(Math.sqrt(sumSq / Math.max(1, samples)))} peak=${peak}`);
        sumSq = 0;
        samples = 0;
        peak = 0;
      }
      if (MODE === 'echo') {
        ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload: msg.media.payload } }));
      }
      return;
    }
    log('<-', msg.event, JSON.stringify(msg).slice(0, 200));
    if (msg.event === 'mark' && MODE === 'close') {
      log('-> closing the socket');
      ws.close();
    }
    if (msg.event === 'start') {
      streamSid = msg.start.streamSid;
      if (MODE !== 'echo' && !sampleSent) {
        sampleSent = true;
        const sample = wavToMulaw(fileURLToPath(new URL('./sample-3s-8khz.wav', import.meta.url)));
        for (let i = 0; i < sample.length; i += 160) {
          ws.send(
            JSON.stringify({ event: 'media', streamSid, media: { payload: sample.subarray(i, i + 160).toString('base64') } }),
          );
        }
        ws.send(JSON.stringify({ event: 'mark', streamSid, mark: { name: 'sample-done' } }));
        log('-> sample + mark sample-done');
        if (MODE === 'clear') {
          setTimeout(() => {
            ws.send(JSON.stringify({ event: 'clear', streamSid }));
            log('-> clear');
          }, 2500);
        }
      }
    }
  });
  ws.on('close', () => log('WS closed'));
});

server.listen(PORT, '0.0.0.0', () => log(`stream-echo-app on :${PORT} (mode=${MODE}, stream host=${HOST})`));
