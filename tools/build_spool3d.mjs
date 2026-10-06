// Builds the web model assets/models/spool.glb from the supplied Blender export
// (source/spool/Pantone_Spool_200mm.glb, ~9.6 MB, ~350k triangles).
//
// - swaps the flange textures for the ones made by tools/build_spool3d_textures.py
// - simplifies the dense strand meshes (meshoptimizer) and joins parts per material
// - resizes textures to 1024 px WebP, quantizes and meshopt-compresses geometry
//
// Usage:
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
//   node tools/build_spool3d.mjs
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplifyPrimitive, join as joinMeshes, flatten, resample, textureCompress, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'source/spool/Pantone_Spool_200mm.glb');
const out = join(root, 'assets/models/spool.glb');
const ERROR = +(process.env.ERROR || 0.002);

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);

// 1. Real wordmark on the flange.
const branded = doc.getRoot().listMaterials().find((m) => m.getName() === 'Matte_Black_Branded');
branded.getBaseColorTexture().setImage(readFileSync(join(root, 'source/spool/flange_base.png'))).setMimeType('image/png');
branded.getNormalTexture().setImage(readFileSync(join(root, 'source/spool/flange_normal.png'))).setMimeType('image/png');

// 2. Geometry. Strands are a 1.75 mm tube on a 200 mm spool; on screen a few
//    hundred pixels wide they need far fewer segments than the source has.
//    Flanges, hub and collars keep their topology so their hard edges stay crisp.
await doc.transform(dedup(), weld());
for (const mesh of doc.getRoot().listMeshes()) {
  if (!mesh.getName().startsWith('Filament_')) continue;
  for (const prim of mesh.listPrimitives()) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0, error: ERROR, lockBorder: false });
}
await doc.transform(
  flatten(),
  joinMeshes({ keepNamed: false }),
  resample(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 90 }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);

// Name materials so the page can find the filament to recolour it.
for (const m of doc.getRoot().listMaterials()) console.log('material', m.getName());
let tris = 0;
for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += p.getIndices().getCount() / 3;
await io.write(out, doc);
console.log(out, (statSync(out).size / 1024).toFixed(0) + ' KB,', Math.round(tris), 'triangles');
