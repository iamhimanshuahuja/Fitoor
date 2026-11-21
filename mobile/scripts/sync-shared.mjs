// Copies the pure-JS helpers from the web app (../src/lib) into src/shared so web and mobile share one source of truth.
// Run after changing any of these files in the web app:  npm run sync-shared
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const WEB = join(here, '..', '..', 'src', 'lib');
const OUT = join(here, '..', 'src', 'shared');
mkdirSync(OUT, { recursive: true });
const FILES = ['dates', 'constants', 'cycle', 'labNames', 'juices', 'legal', 'measure', 'cheer', 'chatLog', 'juiceDays'];
const banner = (f) => `// AUTO-COPIED from src/lib/${f}.js by mobile/scripts/sync-shared.mjs — edit the web file, then run "npm run sync-shared".\n`;
for (const f of FILES) {
  let s = readFileSync(join(WEB, `${f}.js`), 'utf8');
  s = s.replace(/from '\.\/supabase'/g, "from '../lib/supabase'")
       .replace(/from '\.\/ai'/g, "from '../lib/ai'")
       // browser events → tiny cross-platform emitter
       .replace(/window\.dispatchEvent\(new CustomEvent\('ft:cheer', \{ detail: \{ kind(, text)? \} \}\)\);?/g, (_m, t) => `emit('cheer', { kind${t || ''} });`)
       .replace(/window\.dispatchEvent\(new Event\('ft:data-changed'\)\)/g, "emit('data-changed')");
  if (/emit\(/.test(s)) s = "import { emit } from '../lib/events';\n" + s;
  writeFileSync(join(OUT, `${f}.js`), banner(f) + s);
  console.log('synced', f);
}
