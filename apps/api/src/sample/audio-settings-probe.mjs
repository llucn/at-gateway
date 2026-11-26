// Print the module's audio-related settings (read-only AT queries).
//   MODEM_PORT=COM4 node apps/api/src/sample/audio-settings-probe.mjs
import { at, openModem } from './voice-test-helpers.mjs';

const ctx = await openModem();
for (const cmd of ['AT+CSDVC?', 'AT+CLVL?', 'AT+CMUT?', 'AT+CMICGAIN?', 'AT+CRSL?', 'AT+CECM?', 'AT+CNSMOD?', 'AT+CLCC', 'AT+FSLS=C:/', 'AT+FSMEM']) {
  await at(ctx.client, cmd, 5000).catch((e) => console.log(cmd, 'failed:', e.message));
}
await ctx.client.close().catch(() => undefined);
process.exit(0);
