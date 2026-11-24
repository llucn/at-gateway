// Inbound call verification.
//   node apps/api/src/sample/answer-test.mjs [--record-seconds 15]
// Waits for an incoming call, answers it after 3 seconds, plays sample-3s-8khz.wav to the caller
// and saves the caller's voice to ./output (8kHz 16-bit WAV).
// Stop the API (pnpm dev) first: it holds the modem's AT port. Set MODEM_PORT to force a port.
import {
  MODULE_SAMPLE,
  SAMPLE_WAV,
  checkModemReady,
  hangupAndVerify,
  installShutdown,
  listCalls,
  log,
  openModem,
  runAudioSession,
  sleep,
  uploadFile,
  waitForCalls,
  waitForUrc,
} from './voice-test-helpers.mjs';
import { CallState } from '@at-gateway/at-modem';

const argIdx = process.argv.indexOf('--record-seconds');
const recordSeconds = argIdx > 0 ? Number(process.argv[argIdx + 1]) : 15;
const ANSWER_DELAY_MS = 3000;

const ctx = await openModem();
installShutdown(ctx);
let exitCode = 0;
try {
  await checkModemReady(ctx.client);
  await uploadFile(ctx.client, ctx.transport, SAMPLE_WAV, MODULE_SAMPLE);

  const ringUrcs = [];
  ctx.client.on('urc', (l) => {
    if (l === 'RING' || l.startsWith('+CLIP:') || l.startsWith('VOICE CALL') || l === 'NO CARRIER') {
      ringUrcs.push(l);
      log('URC:', l);
    }
  });

  log('Waiting for an incoming call (Ctrl+C to quit)...');
  for (;;) {
    await waitForUrc(ctx.client, (l) => l === 'RING' || l.startsWith('+CLIP:'), 24 * 3600 * 1000, 'incoming call');
    log(`Incoming call, answering in ${ANSWER_DELAY_MS / 1000}s...`);
    await sleep(ANSWER_DELAY_MS);
    const calls = await listCalls(ctx.manager);
    const incoming = calls.find((c) => c.state === CallState.RINGING);
    if (incoming) {
      log('Still ringing from', incoming.phoneNumber);
      break;
    }
    log('Caller hung up before we answered; waiting again.');
  }

  await ctx.manager.answer();
  log('ATA sent');
  const calls = await waitForCalls(
    ctx.manager,
    (c) => c.some((x) => x.state === CallState.ACTIVE),
    10000,
    'the call to become active',
  ).catch(async (e) => {
    await hangupAndVerify(ctx.client, ctx.manager);
    throw e;
  });
  log('Call active:', JSON.stringify(calls));

  const result = await runAudioSession(ctx, { label: 'answer', recordSeconds });
  log('DONE. Recording:', result.file, JSON.stringify(result.info));
  log('URC sequence seen:', JSON.stringify(ringUrcs));
  if (!result.info?.ok) exitCode = 2;
} catch (e) {
  console.error('FAILED:', e.message);
  exitCode = 1;
  await hangupAndVerify(ctx.client, ctx.manager).catch(() => undefined);
} finally {
  await ctx.client.close().catch(() => undefined);
}
process.exit(exitCode);
