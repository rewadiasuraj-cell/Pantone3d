// Builds assets/vendor/three-spool.min.js: the small slice of three.js the 3D
// spool needs (renderer, glTF + meshopt loading, studio lighting), tree-shaken
// into one ES module that src/spool3d.js loads on demand.
// Usage:
//   npm i --no-save three@0.186.1 esbuild
//   node tools/build_three.mjs
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await build({
  stdin: {
    contents: `
      export { WebGLRenderer, Scene, Group, PerspectiveCamera, PMREMGenerator, DirectionalLight, Color, Box3, Vector3, SRGBColorSpace } from 'three';
      export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
      export { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
      export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
    `,
    resolveDir: root,
  },
  bundle: true, minify: true, format: 'esm', target: 'es2020',
  legalComments: 'eof',
  outfile: join(root, 'assets/vendor/three-spool.min.js'),
  banner: { js: '/* three.js r186 (MIT, https://threejs.org) — subset for the Pantone3D spool, built by tools/build_three.mjs */' },
});
console.log('assets/vendor/three-spool.min.js');
