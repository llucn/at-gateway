// Probe: dial a number and, once answered, record segments of different lengths and report how many
// bytes the module captured for each (diagnoses empty recordings).
//   MODEM_PORT=COM4 node apps/api/src/sample/rec-probe.mjs +8613012345678 [ms ms ...]
// Talk during the call.
import { describeWav, hangupAndVerify, log, openModem, sleep } from './voice-test-helpers.mjs';

const number = process.argv[2];
if (!/^\+?[0-9]{3,20}$/.test(number ?? '')) {
  console.error('usage: node rec-probe.mjs <number> [ms ...]');
  process.exit(2);
}
const lengths = process.argv.slice(3).map(Number);
if (lengths.length === 0) lengths.push(1000, 2000, 4000, 1000, 2000);

const ctx = await openModem();
try {
  await ctx.manager.dial(number);
  await ctx.manager.waitForAnswer(60000);
  log('answered; keep talking');
  await sleep(1500);
  for (const ms of lengths) {
    await ctx.client.files.delete('C:/probe.wav');
    await ctx.manager.startRecording('C:/probe.wav');
    await sleep(ms);
    const stop = await ctx.client.sendCommand('AT+CREC=0', 5000);
    const buf = await ctx.client.files.download('C:/probe.wav').catch((e) => Buffer.alloc(0, e.message));
    log(`record ${ms}ms -> ${buf.length} bytes`, buf.length ? JSON.stringify(describeWav(buf)) : '', JSON.stringify(stop.lines));
    await ctx.client.files.delete('C:/probe.wav');
  }
} catch (e) {
  console.error('FAILED:', e.message);
} finally {
  await hangupAndVerify(ctx.client, ctx.manager).catch(() => undefined);
  await ctx.client.close().catch(() => undefined);
}
process.exit(0);
