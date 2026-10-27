// Copies the ONNX Runtime Web WebAssembly files into public/ort/ so the app loads them from its
// own origin (works offline, and the Android build has them bundled).
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const src = join('node_modules', 'onnxruntime-web', 'dist');
const out = join('public', 'ort');
mkdirSync(out, { recursive: true });
let n = 0;
for (const f of readdirSync(src)) {
  // Plain WebAssembly build (no WebGPU/JSEP): smallest, and it runs on any Android WebView.
  if (f === 'ort.wasm.min.mjs' || f === 'ort-wasm-simd-threaded.wasm' || f === 'ort-wasm-simd-threaded.mjs') {
    copyFileSync(join(src, f), join(out, f));
    n++;
  }
}
console.log(`copied ${n} ort files to ${out}`);
