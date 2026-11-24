// Outbound call verification.
//   node apps/api/src/sample/dial-test.mjs [--record-seconds 15]
// Asks for a number, dials, waits for the call to be answered, plays sample-3s-8khz.wav to the
// callee and saves the callee's voice to ./output (8kHz 16-bit WAV).
// Stop the API (pnpm dev) first: it holds the modem's AT port. Set MODEM_PORT to force a port.
import readline from 'node:readline/promises';
import {
  MODULE_SAMPLE,
  SAMPLE_WAV,
  checkModemReady,
  hangupAndVerify,
  installShutdown,
  log,
  openModem,
  runAudioSession,
  uploadFile,
  waitForCalls,
} from './voice-test-helpers.mjs';
import { CallState } from '@at-gateway/at-modem';

const argIdx = process.argv.indexOf('--record-seconds');
const recordSeconds = argIdx > 0 ? Number(process.argv[argIdx + 1]) : 15;
const ANSWER_TIMEOUT_MS = 60000;

async function askNumber() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const n = (await rl.question('Phone number to call (e.g. +8613012345678): ')).trim();
      if (/^\+?[0-9]{3,20}$/.test(n)) return n;
      console.log('Invalid number, digits only with optional leading +.');
    }
  } finally {
    rl.close();
  }
}

const ctx = await openModem();
installShutdown(ctx);
let exitCode = 0;
try {
  await checkModemReady(ctx.client);
  const number = await askNumber();
  await uploadFile(ctx.client, ctx.transport, SAMPLE_WAV, MODULE_SAMPLE);

  log(`Dialing ${number} ...`);
  await ctx.manager.dial(number);
  log('ATD accepted (this is NOT yet "answered"); waiting for the callee to pick up...');

  const calls = await waitForCalls(
    ctx.manager,
    (c) => c.some((x) => x.state === CallState.ACTIVE),
    ANSWER_TIMEOUT_MS,
    'the call to be answered',
  ).catch(async (e) => {
    await hangupAndVerify(ctx.client, ctx.manager);
    throw e;
  });
  log('Call answered:', JSON.stringify(calls));

  const result = await runAudioSession(ctx, { label: 'dial', recordSeconds });
  log('DONE. Recording:', result.file, JSON.stringify(result.info));
  if (!result.info?.ok) exitCode = 2;
} catch (e) {
  console.error('FAILED:', e.message);
  exitCode = 1;
  await hangupAndVerify(ctx.client, ctx.manager).catch(() => undefined);
} finally {
  await ctx.client.close().catch(() => undefined);
}
process.exit(exitCode);
