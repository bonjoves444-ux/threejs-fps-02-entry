// FERRYLINE — Quay 7, a three.js tactical FPS, handed in as a make.fun entry.
//
// What this program does: it takes the game (game/) and its screenshots
// (screenshots/) from the entry's own tree and lays them out in the output
// directory the grader reads, then writes dossier.json with the kit's vendored
// library, exactly the summary the judge reads.
//
// Where things come from and go: the source tree is the directory beside this
// file, or $MAKEFUN_INPUT_DIR when that is set and holds the game; the output
// directory is $MAKEFUN_OUTPUT_DIR, or /output when that is unset. The output
// directory is created when it is missing and its old contents are cleared file
// by file — the directory itself is never removed, because on the grading
// machine it is a mount point and deleting it fails the whole run.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function sourceRoot() {
  const inputDir = process.env.MAKEFUN_INPUT_DIR;
  if (inputDir && existsSync(join(inputDir, 'game'))) return inputDir;
  return here;
}

function clearContents(dir) {
  // Only the contents go: files and folders inside, never the folder itself.
  for (const entry of readdirSync(dir)) {
    const target = join(dir, entry);
    rmSync(target, { recursive: statSync(target).isDirectory(), force: true });
  }
}

const src = sourceRoot();
mkdirSync(outDir, { recursive: true });
clearContents(outDir);
cpSync(join(src, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(src, 'screenshots'))) {
  cpSync(join(src, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);
