// Harbor Heat — the gta6-01 entry program (Node 22, standard library only).
// It hands in the game this directory holds: the playable open-world crime
// game under game/ (plain static files, game/index.html, no network), the
// screenshots/ stills, and /output/dossier.json — the summary the judge
// reads, written by the vendored make.fun library from exactly those files.
//
// Run it:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it: node serve.ts, then open http://localhost:8080

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (the kit's reference/gate.json): text_max_bytes is
// the only cap that shapes the dossier's bytes; the rest refuse an entry
// the scorer would refuse anyway (over 4 screenshots, one over 256 KiB,
// over 993 files or 48 MiB in game/, a game/ path over 1000 bytes).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(out, { recursive: true });
  // Copy the game in full, then the screenshots, then write the dossier
  // from the copies — so the dossier always describes what was handed in.
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
  const shotsOut = join(out, 'screenshots');
  rmSync(shotsOut, { recursive: true, force: true });
  mkdirSync(shotsOut, { recursive: true });
  if (existsSync(join(here, 'screenshots'))) {
    cpSync(join(here, 'screenshots'), shotsOut, { recursive: true });
  }
  const dossier = buildDossier(out, CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);
  console.log(`handed in: game/ + screenshots/ + dossier.json (${dossier.length} bytes) -> ${out}`);
}

handIn();
