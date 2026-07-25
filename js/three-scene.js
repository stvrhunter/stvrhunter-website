/* ==========================================================================
   STVRHUNTER — Three.js hero portrait (ES module)
   --------------------------------------------------------------------------
   Loads the "Me and I" GLB model into #hero-3d, replacing the old face GIF.
   Transparent background so the Lottie blob shows through behind it.

   Resolves `three` / `three/addons/` via the <script type="importmap"> in
   index.html. Loaded with <script type="module">.

   Docs: https://threejs.org/manual/#en/loading-a-gltf-file
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

console.info('[three-scene] Three.js', THREE.REVISION, 'ready.');

const MODEL_URL = 'assets/models/meandI2.glb';

// Procedural sky used as the image-based-lighting environment, so the model's
// reflections & ambient read as "outdoors in the sky" instead of a studio room.
// A vertical gradient (zenith blue -> bright horizon -> teal haze) plus a warm
// sun glow. Matches the page's #003e6b -> #0eaebc sky palette.
function makeSkyEquirect() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.00, '#5b93c8'); // zenith blue
  g.addColorStop(0.45, '#a9cef0'); // upper sky
  g.addColorStop(0.60, '#eaf4fb'); // bright horizon
  g.addColorStop(0.78, '#59c0cb'); // teal
  g.addColorStop(1.00, '#0eaebc'); // teal haze (page's bottom stop)
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Warm sun glow, upper-right — becomes the bright specular highlight.
  const sx = W * 0.68, sy = H * 0.30, sr = H * 0.42;
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
  sun.addColorStop(0.0, 'rgba(255,246,224,0.95)');
  sun.addColorStop(0.4, 'rgba(255,240,205,0.35)');
  sun.addColorStop(1.0, 'rgba(255,240,205,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  // Crisp bright sun disc -> a defined, sharp specular highlight on glossy parts.
  ctx.fillStyle = 'rgba(255,252,240,1)';
  ctx.beginPath();
  ctx.arc(sx, sy, H * 0.05, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Seamless grayscale "cloud shadow" texture used as a light cookie (gobo).
// White = full light, dark blobs = cloud shadows. Tiles seamlessly so it can be
// scrolled forever; scrolling its offset makes the shadows drift over the model.
function makeCloudGobo() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < 8; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = S * (0.12 + Math.random() * 0.18);
    // Hard, near-black core with a feathered rim => a strong, clearly visible
    // moving shadow (not a faint dimming).
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, r * 0.5, x + dx, y + dy, r);
        g.addColorStop(0, 'rgba(0,0,0,0.98)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1.5); // fewer, bigger shadow shapes across the face
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function initHeroModel(container) {
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const getSize = () => ({
    w: container.clientWidth || 1,
    h: container.clientHeight || 1,
  });

  let { w, h } = getSize();

  const scene = new THREE.Scene(); // no background => transparent

  const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 1000);

  // Pixelation toggle. When on, render into a small buffer and let CSS upscale
  // it with nearest-neighbour (image-rendering: pixelated). When off, render
  // normally — crisp, antialiased, retina resolution. Flip PIXELATE to restore.
  const PIXELATE = true;
  const PIXEL_SIZE = 7; // CSS px per rendered pixel when PIXELATE is on

  const renderer = new THREE.WebGLRenderer({ antialias: !PIXELATE, alpha: true });
  renderer.setPixelRatio(PIXELATE ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18; // overall brightness
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // crisper, harder shadow edges
  container.appendChild(renderer.domElement);

  // Canvas always fills the container; only the drawing-buffer size differs.
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.imageRendering = PIXELATE ? 'pixelated' : 'auto';

  function applySize() {
    if (PIXELATE) {
      const lowW = Math.max(1, Math.round(w / PIXEL_SIZE));
      const lowH = Math.max(1, Math.round(h / PIXEL_SIZE));
      renderer.setSize(lowW, lowH, false); // false => don't touch canvas CSS size
    } else {
      renderer.setSize(w, h, false);
    }
  }
  applySize();

  // Image-based lighting from the PROCEDURAL sky (gradient + a crisp sun disc).
  // A lower material roughness + higher envMapIntensity (set on load) turn that
  // bright sun disc into a sharp, clearly visible specular reflection.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyTex = makeSkyEquirect();
  scene.environment = pmrem.fromEquirectangular(skyTex).texture;
  skyTex.dispose();
  scene.environmentIntensity = 0.4; // sky reflections, but less blue cast

  // Sky fill — kept close to neutral (soft sky above, warm bounce below) so the
  // model doesn't pick up a heavy blue tint from the sky.
  const hemi = new THREE.HemisphereLight(0xdfe7ee, 0x8a7860, 1.28);
  scene.add(hemi);

  // Subtle animated "sun" — sweeps for life; the cloud projector below is the
  // hard key light that throws the strong, visible moving shadows.
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(3, 5, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.015;
  scene.add(sun);
  scene.add(sun.target); // stays at origin (the model's centre)

  // Drifting cloud shadows: a spotlight used as a projector ("gobo"). Its cloud
  // texture (map) modulates the light, and we scroll that texture each frame so
  // soft cloud shadows sweep across the model — like clouds passing overhead.
  // It's the main key here, so where a "cloud" covers the face it goes dark.
  const cloudGobo = makeCloudGobo();
  const projector = new THREE.SpotLight(0xfff6e6, 13.0, 0, 0.5, 0.12, 0);
  projector.map = cloudGobo;
  projector.castShadow = true;
  projector.shadow.mapSize.set(1024, 1024);
  projector.shadow.bias = -0.0004;
  scene.add(projector);
  scene.add(projector.target); // aimed at origin

  // Cool rim/fill point light that drifts each frame for extra life.
  const dynamicLight = new THREE.PointLight(0x8ec5ff, 14, 0, 2);
  scene.add(dynamicLight);

  // Pivot lets us spin the model around its own centre.
  const pivot = new THREE.Group();
  scene.add(pivot);

  let model = null;
  let orbitR = 3;  // radius the dynamic light orbits at (set once the model is sized)
  let sunDist = 5; // how far the sun sits from the model (set on load)

  const ZOOM_BASE = 1.5; // render the model 1.5x larger in frame
  // Desktop shows the model 15% larger than smaller screens.
  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
  let sphereRadius = 1; // model bounding-sphere radius (set on load)
  let fitReady = false;

  // Frame the camera so the whole model fits regardless of viewport aspect
  // (fits the *smaller* dimension, so it never gets cropped on narrow screens).
  function frameModel() {
    if (!fitReady) return;
    const vFov = (camera.fov * Math.PI) / 180;
    const distV = sphereRadius / Math.sin(vFov / 2);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const distH = sphereRadius / Math.sin(hFov / 2);
    const zoom = ZOOM_BASE * (isDesktop() ? 1.15 : 1);
    const dist = (Math.max(distV, distH) * 1.15) / zoom;
    camera.position.set(0, 0, dist);
    camera.near = Math.max(dist / 100, 0.01);
    camera.far = dist * 100;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
  }

  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      model = gltf.scene;

      // Centre the model and frame the camera to its bounding sphere.
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const sphere = box.getBoundingSphere(new THREE.Sphere());

      model.position.sub(center); // recentre at origin
      pivot.add(model);

      // Let every mesh cast & receive shadows. Crucially, the main head mesh
      // ships as an *unlit* MeshBasicMaterial (ignores all lights/shadows/env),
      // which is why it looked baked — upgrade it to a lit MeshStandardMaterial
      // that keeps the same photo texture but now responds to the sun & sky.
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;

        let m = o.material;
        if (m && m.isMeshBasicMaterial) {
          const std = new THREE.MeshStandardMaterial({
            map: m.map || null,
            color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
            transparent: m.transparent,
            alphaTest: m.alphaTest,
            alphaMap: m.alphaMap || null,
            side: m.side,
            roughness: 0.5, // glossier => sharper, more visible sky reflections
            metalness: 0.0,
          });
          if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
          o.material = std;
          m.dispose();
          m = std;
        }
        if (m && 'envMapIntensity' in m) {
          m.envMapIntensity = 1.05; // less blue sky reflected onto the skin
          m.needsUpdate = true;
        }
      });

      orbitR = sphere.radius * 1.6; // scale the light orbit to the model
      sunDist = sphere.radius;      // scale the sun distance to the model

      // Fit the sun's shadow frustum snugly around the model.
      const r = sphere.radius;
      const sc = sun.shadow.camera;
      sc.left = -r * 1.6; sc.right = r * 1.6;
      sc.top = r * 1.6;  sc.bottom = -r * 1.6;
      sc.near = 0.1;     sc.far = r * 14;
      sc.updateProjectionMatrix();

      // Place the cloud projector far in front/above (near-parallel, sun-like)
      // and aim it at the model so its cloud shadows fall across the face.
      projector.position.set(r * 1.2, r * 4.5, r * 2.5);
      projector.target.position.set(0, 0, 0);
      projector.shadow.camera.near = r * 0.5;
      projector.shadow.camera.far = r * 14;
      projector.shadow.camera.updateProjectionMatrix();

      sphereRadius = sphere.radius;
      fitReady = true;
      frameModel();

      // Apply the resting pose immediately so the first frame is correct.
      pivot.rotation.set(BASE_PITCH, BASE_YAW, BASE_ROLL);

      container.setAttribute('data-loaded', 'true');
    },
    undefined,
    (err) => {
      console.error('[three-scene] failed to load model:', err);
    }
  );

  // Subtle cursor parallax (container has pointer-events:none, so listen globally).
  const target = { x: 0, y: 0 };
  if (!prefersReducedMotion) {
    window.addEventListener(
      'pointermove',
      (e) => {
        target.x = (e.clientX / window.innerWidth - 0.5) * 0.6; // ~±0.3 rad
        target.y = (e.clientY / window.innerHeight - 0.5) * 0.3;
      },
      { passive: true }
    );
  }

  // Model's face points along +X, so yaw -90° to face the camera;
  // -20° nudges it a bit to the left.
  const BASE_YAW = -Math.PI / 2 - THREE.MathUtils.degToRad(20);
  // Tilt the model 30° on the X axis; no Z-axis roll (head upright).
  const BASE_PITCH = THREE.MathUtils.degToRad(30);
  const BASE_ROLL = 0;

  // Smoothed cursor offset applied on top of the fixed resting pose.
  const offset = { x: 0, y: 0 };

  let frame = null;
  function animate() {
    frame = requestAnimationFrame(animate);

    // Dynamic light orbits the model (paused for reduced-motion users).
    const t = prefersReducedMotion ? 0.5 : performance.now() * 0.001;

    // Scroll the cloud cookie so its shadows drift across the model.
    cloudGobo.offset.set(t * 0.06, t * 0.028);

    dynamicLight.position.set(
      Math.cos(t * 0.8) * orbitR,
      Math.sin(t * 0.5) * orbitR * 0.6,
      Math.sin(t * 0.8) * orbitR + orbitR * 0.5
    );

    if (model) {
      if (!prefersReducedMotion) {
        offset.x += (target.x - offset.x) * 0.08;
        offset.y += (target.y - offset.y) * 0.08;
      }
      // Static resting pose + subtle lean toward the cursor.
      pivot.rotation.set(BASE_PITCH + offset.y, BASE_YAW + offset.x, BASE_ROLL);

      // The sun sweeps in an arc around the model (plus a cursor lean), so its
      // raking light throws self-shadows that visibly move across the face.
      const az = Math.sin(t * 0.35) * 1.0 + offset.x * 0.9; // left <-> right sweep
      const Rh = sunDist * 1.35;
      sun.position.set(
        Math.sin(az) * Rh,
        sunDist * (1.15 - offset.y * 0.5),
        Math.cos(az) * Rh * 0.5 + sunDist * 0.25
      );
    }
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    ({ w, h } = getSize());
    camera.aspect = w / h;
    applySize();
    frameModel(); // re-fit so the model stays correctly sized at any aspect
  }
  window.addEventListener('resize', onResize);

  return {
    dispose() {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

const hero = document.getElementById('hero-3d');
if (hero) {
  initHeroModel(hero);
}
