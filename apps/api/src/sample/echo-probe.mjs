// Probe: dial, then record 3s of the remote party, report its loudness, play it straight back.
//   MODEM_PORT=COM4 node apps/api/src/sample/echo-probe.mjs +8613012345678
// Isolates the audio path from the WebSocket bridge. Talk during the 3s recording windows.
import fs from 'node:fs';
import path from 'node:path';
import {
  OUTPUT_DIR,
  describeWav,
  hangupAndVerify,
  log,
  openModem,
  sleep,
  stamp,
} from './voice-test-helpers.mjs';

const number = process.argv[2];
if (!/^\+?[0-9]{3,20}$/.test(number ?? '')) {
  console.error('usage: node echo-probe.mjs <number>');
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
  return { rms: Math.round(Math.sqrt(sum / Math.max(1, n))), peak };
}

const ctx = await openModem();
try {
  await ctx.manager.dial(number);
  await ctx.manager.waitForAnswer(60000);
  log('answered; speak now (3 rounds: record 3s, then it plays back)');
  await sleep(1000);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (let round = 1; round <= 3; round++) {
    await ctx.client.files.delete('C:/ep_rec.wav');
    await ctx.manager.startRecording('C:/ep_rec.wav');
    log(`round ${round}: recording 3s - SPEAK`);
    await sleep(3000);
    await ctx.manager.stopRecording();
    const wav = await ctx.client.files.download('C:/ep_rec.wav');
    const out = path.join(OUTPUT_DIR, `echo-probe-${stamp()}-r${round}.wav`);
    fs.writeFileSync(out, wav);
    log(`recorded ${wav.length} bytes`, JSON.stringify(describeWav(wav)), JSON.stringify(loudness(wav)), out);
    await ctx.client.files.upload('C:/ep_play.wav', wav);
    const end = ctx.manager.waitForPlaybackEnd(15000);
    end.promise.catch(() => undefined);
    await ctx.manager.playToRemote('C:/ep_play.wav');
    log(`round ${round}: playing it back - LISTEN`);
    await end.promise;
    await ctx.client.files.delete('C:/ep_play.wav');
    await sleep(500);
  }
} catch (e) {
  console.error('FAILED:', e.message);
} finally {
  await hangupAndVerify(ctx.client, ctx.manager).catch(() => undefined);
  await ctx.client.close().catch(() => undefined);
}
process.exit(0);
