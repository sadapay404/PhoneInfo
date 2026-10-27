// Fetches the on-device background-removal model (ISNet, MIT licence) into public/models/.
// The model weights are taken from the npm tarball of a published package, split into
// hash-named chunks. Each chunk is checked against its SHA-256 before the file is assembled.
// Nothing is committed to git: public/models/ is ignored. Runs before dev and build.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PKG = '@imgly/background-removal-node@1.4.5';
const OUT = join('public', 'models', 'isnet-medium.onnx');
const KEY = '/models/medium';
const EXPECTED_SIZE = 88188479;

if (existsSync(OUT) && statSync(OUT).size === EXPECTED_SIZE) {
  console.log(`model present: ${OUT}`);
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), 'isnet-'));
try {
  const tgz = execFileSync('npm', ['pack', PKG, '--silent'], { cwd: work, encoding: 'utf8' }).trim().split('\n').pop();
  execFileSync('tar', ['-xzf', join(work, tgz), '-C', work]);
  const dist = join(work, 'package', 'dist');
  const res = JSON.parse(readFileSync(join(dist, 'resources.json'), 'utf8'))[KEY];
  if (!res) throw new Error(`model key ${KEY} not found`);

  mkdirSync(join('public', 'models'), { recursive: true });
  writeFileSync(OUT, Buffer.alloc(0));
  for (const c of res.chunks) {
    const buf = readFileSync(join(dist, c.hash));
    const sum = createHash('sha256').update(buf).digest('hex');
    if (sum !== c.hash) throw new Error(`chunk hash mismatch ${c.hash}`);
    appendFileSync(OUT, buf);
  }
  const size = statSync(OUT).size;
  if (size !== res.size) throw new Error(`size ${size} != ${res.size}`);
  console.log(`model written: ${OUT} (${size} bytes)`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
