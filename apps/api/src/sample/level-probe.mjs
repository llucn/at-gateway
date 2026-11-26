// Probe: how loud is the remote voice recording, with and without a prior playback in the call?
//   MODEM_PORT=COM4 node apps/api/src/sample/level-probe.mjs +8613012345678
// Speak continuously for the whole call (about 30 s).
import {
  MODULE_SAMPLE,
  SAMPLE_WAV,
  hangupAndVerify,
  log,
  openModem,
  sleep,
  uploadFile,
} from './voice-test-helpers.mjs';

const number = process.argv[2];
if (!/^\+?[0-9]{3,20}$/.test(number ?? '')) {
  console.error('usage: node level-probe.mjs <number>');
  process.exit(2);
}

function loudness(wav) {
  const pcm = wav.subarray(44);
  let sum = 0;
  let peak = 0;
  const n = Math.floor(pcm.length / 2);
  for (let i = 0; i < n; i++) {
    const v = pcm.readInt16LE(i * 2);
    sum += v * v;
    peak = Math.max(peak, Math.abs(v));
  }
  return `rms=${Math.round(Math.sqrt(sum / Math.max(1, n)))} peak=${peak}`;
}

const ctx = await openModem();
const { client, manager, transport } = ctx;
async function record(label, ms = 2500) {
  await client.files.delete('C:/lp.wav');
  await manager.startRecording('C:/lp.wav');
  await sleep(ms);
  await manager.stopRecording();
  const wav = await client.files.download('C:/lp.wav');
  log(`${label}: ${wav.length} bytes ${loudness(wav)}`);
}
async function playSample() {
  const end = manager.waitForPlaybackEnd(15000);
  end.promise.catch(() => undefined);
  await manager.playToRemote(MODULE_SAMPLE);
  await end.promise;
  log('sample played');
}

try {
  await uploadFile(client, transport, SAMPLE_WAV, MODULE_SAMPLE);
  await manager.dial(number);
  await manager.waitForAnswer(60000);
  log('answered; SPEAK CONTINUOUSLY');
  await sleep(1000);
  await record('baseline', 1000);
  const trials = [
    ['plain wait', async () => {}],
    ['AT+CCMXSTOP', async () => { log('->', (await client.sendCommand('AT+CCMXSTOP', 5000)).result); }],
    ['AT+CSDVC=1', async () => { log('->', (await client.sendCommand('AT+CSDVC=1', 5000)).result); }],
    ['AT+CMUT toggle', async () => { await client.sendCommand('AT+CMUT=1', 5000); await client.sendCommand('AT+CMUT=0', 5000); }],
  ];
  for (const [name, fix] of trials) {
    log(`--- trial: play sample, then ${name}, then 1s records`);
    await playSample();
    await fix();
    for (let i = 1; i <= 6; i++) await record(`  rec ${i}`, 1000);
  }
} catch (e) {
  console.error('FAILED:', e.message);
} finally {
  await hangupAndVerify(client, manager).catch(() => undefined);
  await client.close().catch(() => undefined);
}
process.exit(0);
