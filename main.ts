// Canyon Courier — the hand-in program for the best-flight-game-01 bounty.
// Node 22, standard library only. The game itself is this directory's game/
// folder: plain static files a desktop browser loads offline (game/index.html and
// its ES modules, no library, no network request). This program copies game/ and
// screenshots/ from beside itself to /output and writes /output/dossier.json — the
// summary the judge reads — with the vendored make.fun library.
//
// Play it locally first: `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps: only text_max_bytes shapes the dossier bytes. The rest
// refuse an entry the scorer would refuse — more than 4 screenshots or one over
// 256 KiB; more than 993 files in game/ or 48 MiB of game files in all; or a path
// under game/ over 1000 bytes. game/ counts beside /output's own 1000-entry cap,
// which game/, screenshots/ and dossier.json share.
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  const shotsOut = join(outDir, 'screenshots');
  mkdirSync(shotsOut, { recursive: true });
  const shotsIn = join(repoRoot, 'screenshots');
  if (existsSync(shotsIn)) cpSync(shotsIn, shotsOut, { recursive: true });
  const dossier = buildDossier(outDir, DOSSIER_LIMITS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();
