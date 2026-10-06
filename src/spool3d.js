/* Pantone3D — the real 3D spool.
 *
 * Loads a trimmed three.js build and the compressed spool model on demand and
 * draws them into one small transparent canvas. The page decides where that
 * canvas sits (it is moved between the hero/About travel box and the Materials
 * stage) and sets the pose and filament colour every frame from scroll.
 * Nothing here runs unless spool3DSupported() says the device can take it; the
 * product photos stay in place underneath as the fallback.
 */
const VERSION = '20261006c';
const VENDOR = 'assets/vendor/three-spool.min.js?v=' + VERSION;
const MODEL = 'assets/models/spool.glb?v=' + VERSION;
const DIAMETER = 0.2; // model units are metres: a 200 mm spool
const FOV = 20;

export function spool3DSupported(mobile) {
  if (location.protocol === 'file:') return false;
  const c = navigator.connection;
  if (c && (c.saveData || /2g|3g/.test(c.effectiveType || ''))) return false;
  if (mobile && ((navigator.deviceMemory || 4) < 4 || (navigator.hardwareConcurrency || 4) < 4)) return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch (e) { return false; }
}

export async function loadSpool3D({ dpr = 2 } = {}) {
  const url = (p) => new URL(p, document.baseURI).href;
  const T = await import(url(VENDOR));

  const canvas = document.createElement('canvas');
  canvas.className = 'spool3d';
  canvas.setAttribute('aria-hidden', 'true');
  // High-density screens are sharp enough without MSAA, and skipping it is cheaper.
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: (devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dpr));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  // No tone mapping: it would pale the filament towards white in the highlights.

  const scene = new T.Scene();
  // Studio lighting, set per material (scene.environment would override each
  // material's intensity with one value for all).
  const pmrem = new T.PMREMGenerator(renderer);
  const studio = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  // A soft key from the upper left, like the product photography.
  const key = new T.DirectionalLight(0xffffff, 1.5);
  key.position.set(-1.2, 1.4, 1.6);
  scene.add(key);
  // A rim from behind on the right picks the flange edges out of the dark page.
  const rim = new T.DirectionalLight(0xffffff, 2.2);
  rim.position.set(1.6, 0.9, -1.1);
  scene.add(rim);

  const camera = new T.PerspectiveCamera(FOV, 1, 0.05, 10);
  camera.position.set(0, 0, 1);

  const gltf = await new T.GLTFLoader().setMeshoptDecoder(T.MeshoptDecoder).loadAsync(url(MODEL));
  const model = gltf.scene;
  const centre = new T.Box3().setFromObject(model).getCenter(new T.Vector3());
  model.position.sub(centre);
  const filament = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material, isFilament = m.name === 'Yellow_Filament';
    m.envMap = studio;
    // Turn the studio so its bright wall sits behind the spool: face-on, the
    // flange then reflects the dark side. Keep the matte black plastic's
    // reflections faint so it never reads grey.
    m.envMapRotation.set(0, Math.PI, 0);
    m.envMapIntensity = isFilament ? 1.25 : 0.35;
    if (isFilament) filament.push(m);
  });

  // lean (screen plane) > pivot (turn + tilt) > spinner (around the axle) > model
  const lean = new T.Group(), pivot = new T.Group(), spinner = new T.Group();
  pivot.rotation.order = 'YXZ';
  spinner.add(model); pivot.add(spinner); lean.add(pivot); scene.add(lean);

  let w = 0, h = 0, dia = 0, last = '';
  const colour = new T.Color();

  // Canvas size in CSS px, and how many px the flange diameter should span.
  function size(cw, ch, diameterPx) {
    cw = Math.max(1, Math.round(cw)); ch = Math.max(1, Math.round(ch));
    if (cw === w && ch === h && diameterPx === dia) return;
    w = cw; h = ch; dia = diameterPx;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const viewH = 2 * Math.tan((FOV * Math.PI) / 360) * camera.position.z;
    lean.scale.setScalar((dia / h) * viewH / DIAMETER);
    last = '';
  }

  // matte: 0 glossy filament … 1 matte (Matte PLA, Carbon Fiber).
  function render({ ry = 0, rx = 0, spin = 0, roll = 0, rgb = [255, 255, 255], matte = 0 } = {}) {
    const k = [ry, rx, spin, roll, matte].map((v) => v.toFixed(4)).join() + rgb.map(Math.round).join() + w + 'x' + h;
    if (k === last) return;
    last = k;
    colour.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, T.SRGBColorSpace);
    filament.forEach((m) => { m.color.copy(colour); m.roughness = 0.4 + matte * 0.4; });
    pivot.rotation.set(rx, ry, 0);
    spinner.rotation.z = spin;
    lean.rotation.z = roll;
    renderer.render(scene, camera);
  }

  // Compile shaders and upload buffers now, not on the first scrolled frame.
  renderer.compile(scene, camera);
  return { canvas, size, render };
}
