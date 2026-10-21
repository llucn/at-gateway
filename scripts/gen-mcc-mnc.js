// Run: node scripts/gen-mcc-mnc.js
const fs = require('fs');
const lines = fs.readFileSync('mcc-mnc.csv', 'utf8').replace(/^\uFEFF/, '').split('\n');
const seen = new Set();
const entries = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const parts = line.split(';');
  const mcc = (parts[0] || '').trim();
  const mncRaw = (parts[1] || '').trim();
  const country = (parts[4] || '').trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const operator = (parts[6] || '').trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const brand = (parts[7] || '').trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  if (!mcc || !mncRaw) continue;
  const mnc = mncRaw.padStart(2, '0');
  const key = mcc + mnc;
  if (seen.has(key)) continue;
  seen.add(key);
  const display = brand || operator;
  entries.push(`  '${key}': { country: '${country}', operator: '${display}' }`);
}

const out = [
  '// Auto-generated from mcc-mnc.csv — do not edit manually',
  'export interface MccMncEntry { country: string; operator: string }',
  '',
  'const MCC_MNC_TABLE: Record<string, MccMncEntry> = {',
  entries.join(',\n'),
  '};',
  '',
  'export function lookupPlmn(plmn: string | undefined): MccMncEntry | null {',
  '  if (!plmn || plmn.length < 5) return null;',
  '  // 5-digit key (MCC 3 + MNC 2), then 6-digit (MCC 3 + MNC 3)',
  '  return MCC_MNC_TABLE[plmn.slice(0, 5)] ?? MCC_MNC_TABLE[plmn.slice(0, 6)] ?? null;',
  '}',
].join('\n');

fs.writeFileSync('apps/web/src/lib/mcc-mnc.ts', out);
console.log('Written', entries.length, 'entries to apps/web/src/lib/mcc-mnc.ts');
