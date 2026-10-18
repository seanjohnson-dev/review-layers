// Speaks each line of the piece on its own (za:Fenrir), so every sentence can be placed on its beat.
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const T = '/Users/seanjohnson/.claude/skills/media-studio/tools/';
const { requireKey, catalogue } = await import(T + 'lib.mjs');
const { speak, voiceCost } = await import(T + 'engine.mjs');
requireKey();
const LINES = JSON.parse(fs.readFileSync(new URL('./lines.json', import.meta.url), 'utf8'));
const models = await catalogue();
const est = LINES.reduce((n, l) => n + voiceCost(models, l.text, 'za:Fenrir').usd, 0);
console.log(`estimate for ${LINES.length} lines: $${est.toFixed(4)}`);
if (process.argv.includes('--dry-run')) process.exit(0);
if (est > 0.03) throw new Error('over the agreed cap');
let i = 0;
for (const l of LINES) {
  i++;
  const out = path.resolve('out/vo', `${String(i).padStart(2, '0')}.m4a`);
  if (fs.existsSync(out)) { console.log('have', out); continue; }
  await speak({ text: l.text, voice: 'za:Fenrir', out });
  const d = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
  console.log(`${i}: ${d}s  ${l.text.slice(0, 50)}`);
}
fs.appendFileSync(path.join(process.env.HOME, '.config/media-studio/spend.jsonl'), JSON.stringify({ at: new Date().toISOString(), kind: 'voice', model: 'google/gemini-3.8-flash-tts', usd: est, out: path.resolve('out/vo'), label: 'review-layers motion, 16 lines' }) + '\n');
