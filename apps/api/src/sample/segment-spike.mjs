// Feasibility spike for the Twilio media stream bridge (tasks 1.1-1.3).
//   MODEM_PORT=COM4 node apps/api/src/sample/segment-spike.mjs +8613012345678
// Dials the number, and once answered measures on the module:
//   A) sequential segmented recording (stop -> download -> start next): gap and fetch time
//   B) overlapped: start segment B, then download segment A while B is recording
//   C) two consecutive AT+CCMXPLAY calls, and AT+CCMXSTOP followed by a new play
// Talk continuously during the call so recordings contain speech. Results go to stdout as JSON.
import {
  MODULE_SAMPLE,
  SAMPLE_WAV,
  checkModemReady,
  describeWav,
  hangupAndVerify,
  installShutdown,
  log,
  openModem,
  sleep,
  uploadFile,
} from './voice-test-helpers.mjs';

const number = process.argv[2];
if (!/^\+?[0-9]{3,20}$/.test(number ?? '')) {
  console.error('usage: node segment-spike.mjs <phone number>');
  process.exit(2);
}
const SEG_MS = 1000;
const REC_A = 'C:/sp_a.wav';
const REC_B = 'C:/sp_b.wav';
const now = () => Number(process.hrtime.bigint() / 1000000n);
const results = { segmentMs: SEG_MS };

const ctx = await openModem();
installShutdown(ctx);
const { client, transport, manager } = ctx;
let exitCode = 0;

async function startRec(path) {
  await client.files.delete(path);
  try {
    await manager.startRecording(path);
  } catch (e) {
    const calls = await manager.getCallStatus().catch(() => []);
    log(`startRecording failed (${e.message}); calls=${JSON.stringify(calls)}; retrying in 300ms`);
    await sleep(300);
    await manager.startRecording(path);
    results.startRecordRetries = (results.startRecordRetries ?? 0) + 1;
  }
}
async function fetchAndDelete(path) {
  const t = now();
  const buf = await client.files.download(path);
  const fetchMs = now() - t;
  await client.files.delete(path);
  return { fetchMs, info: describeWav(buf), bytes: buf.length };
}

try {
  await checkModemReady(client);
  const t0 = now();
  await uploadFile(client, transport, SAMPLE_WAV, MODULE_SAMPLE);
  results.upload48kBMs = now() - t0;

  log(`Dialing ${number}; please answer and keep talking...`);
  await manager.dial(number);
  await manager.waitForAnswer(60000);
  log('Answered');
  await sleep(1500);

  // ---- A: sequential segments
  const A = [];
  for (let i = 0; i < 5; i++) {
    const s = now();
    await startRec(REC_A);
    const startedAt = now();
    await sleep(SEG_MS);
    const stopT = now();
    await manager.stopRecording();
    const stoppedAt = now();
    const f = await fetchAndDelete(REC_A);
    const doneAt = now();
    A.push({
      i,
      startCmdMs: startedAt - s,
      wallRecordMs: stoppedAt - startedAt,
      stopCmdMs: stoppedAt - stopT,
      fetchMs: f.fetchMs,
      wavSeconds: f.info.seconds,
      wavOk: f.info.ok,
      // time with no recording running between two segments = stop + fetch + next start
      gapMs: doneAt - stoppedAt + (startedAt - s),
    });
    log('A', JSON.stringify(A.at(-1)));
  }
  results.A_sequential = A;

  // ---- B: overlapped download
  const B = [];
  await startRec(REC_A);
  for (let i = 0; i < 4; i++) {
    await sleep(SEG_MS);
    const cur = i % 2 === 0 ? REC_A : REC_B;
    const next = i % 2 === 0 ? REC_B : REC_A;
    const sw = now();
    await manager.stopRecording();
    await client.files.delete(next);
    // The module rejects CREC for a short while after a stop: retry and record how long it took.
    let attempts = 0;
    for (;;) {
      attempts++;
      try {
        await manager.startRecording(next); // next segment records while we fetch `cur`
        break;
      } catch (e) {
        if (attempts >= 15) throw e;
        await sleep(100);
      }
    }
    const switchMs = now() - sw;
    let fetch;
    try {
      fetch = await fetchAndDelete(cur);
    } catch (e) {
      fetch = { error: e.message };
    }
    B.push({ i, switchMs, startAttempts: attempts, ...fetch, wavSeconds: fetch.info?.seconds });
    log('B', JSON.stringify({ ...B.at(-1), info: undefined }));
  }
  await manager.stopRecording();
  const last = await fetchAndDelete(REC_A).catch(() => fetchAndDelete(REC_B)).catch((e) => ({ error: e.message }));
  B.push({ final: true, wavSeconds: last.info?.seconds, error: last.error });
  results.B_overlapped = B;

  // ---- C: playback timing
  const C = {};
  const playOnce = async () => {
    const end = manager.waitForPlaybackEnd(15000);
    end.promise.catch(() => undefined);
    const t = now();
    let attempts = 0;
    for (;;) {
      attempts++;
      try {
        await manager.playToRemote(MODULE_SAMPLE);
        break;
      } catch (e) {
        if (attempts >= 15) throw e;
        await sleep(100); // the module rejects play for a moment after a recording stop
      }
    }
    const cmdMs = now() - t;
    await end.promise;
    return { attempts, cmdMs, totalMs: now() - t };
  };
  C.play1 = await playOnce();
  C.play2 = await playOnce(); // immediately after the first finished
  // stop in the middle, then play again
  const end = manager.waitForPlaybackEnd(15000);
  end.promise.catch(() => undefined);
  await manager.playToRemote(MODULE_SAMPLE);
  await sleep(1000);
  const ts = now();
  await manager.stopPlayback();
  await end.promise.catch(() => undefined);
  C.stopToEndUrcMs = now() - ts;
  C.playAfterStop = await playOnce().catch((e) => ({ error: e.message }));
  results.C_playback = C;
  log('C', JSON.stringify(C));
} catch (e) {
  console.error('FAILED:', e.message);
  exitCode = 1;
} finally {
  await manager.stopRecording().catch(() => undefined);
  await hangupAndVerify(client, manager).catch(() => undefined);
  await client.files.delete(REC_A).catch(() => undefined);
  await client.files.delete(REC_B).catch(() => undefined);
  await client.close().catch(() => undefined);
}
console.log('RESULTS', JSON.stringify(results, null, 2));
process.exit(exitCode);
