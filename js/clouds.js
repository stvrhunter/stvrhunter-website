/* ==========================================================================
   STVRHUNTER — fly-through cloud background (ES module)
   --------------------------------------------------------------------------
   Replaces the old Vanta.js clouds. Renders a field of 8,000 fog-blended
   billboard sprites into .hero__bg and flies the camera forward through them,
   with subtle mouse parallax. Technique reverse-engineered from pxpush.com.

   Resolves `three` / `three/addons/` via the <script type="importmap"> in
   index.html (three@0.185.x). Loaded with <script type="module">.

   Sky gradient lives in styles.css (.hero__bg background); the WebGL canvas
   is transparent and sits on top of it.
   ========================================================================== */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---- tunables ---------------------------------------------------------- */
const PLANE_COUNT = 8000;     // number of scattered cloud sprites
const PLANE_SIZE  = 64;       // each sprite quad size
const LOOP_LEN    = 8000;     // Z travel distance before the field repeats
const FOG_COLOR   = 0x0eaebc; // teal — matches the gradient's bottom stop
const FOG_NEAR    = -100;
const FOG_FAR     = 3000;
const TINT        = 0xdce7f5; // cool white tint on the sprites
const BRIGHTNESS  = 0.9;
const CAM_FOV     = 30;
const DRIFT_SPEED = 0.18;     // forward fly-through speed
const TEXTURE_URL = 'assets/cloud10.png';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = `
  uniform sampler2D map;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  uniform float brightness;
  uniform vec3 tint;
  varying vec2 vUv;
  void main() {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = smoothstep(fogNear, fogFar, depth);
    vec4 texColor = texture2D(map, vUv);
    texColor.rgb *= brightness;
    texColor.rgb *= tint;
    texColor.w *= pow(gl_FragCoord.z, 20.0);
    gl_FragColor = mix(texColor, vec4(fogColor, texColor.w), fogFactor);
  }
`;

// Soft procedural fallback if the cloud PNG fails to load.
function makeFallbackTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const cx = s * (0.25 + Math.random() * 0.5);
    const cy = s * (0.35 + Math.random() * 0.35);
    const r  = s * (0.10 + Math.random() * 0.22);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${0.10 + Math.random() * 0.12})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function initClouds() {
  const el = document.querySelector('.hero__bg');
  if (!el) return;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(CAM_FOV, 1, 1, 3000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  el.appendChild(canvas);

  const fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
  scene.fog = fog;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      map:        { value: null },
      fogColor:   { value: fog.color },
      fogNear:    { value: fog.near },
      fogFar:     { value: fog.far },
      brightness: { value: BRIGHTNESS },
      tint:       { value: new THREE.Color(TINT) },
    },
    vertexShader,
    fragmentShader,
    depthWrite: false,
    depthTest: false,
    transparent: true,
  });

  new THREE.TextureLoader().load(
    TEXTURE_URL,
    (t) => { t.colorSpace = THREE.SRGBColorSpace; material.uniforms.map.value = t; },
    undefined,
    () => { material.uniforms.map.value = makeFallbackTexture(); }
  );

  // Scatter PLANE_COUNT quads through depth, then merge into one geometry.
  const base = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE);
  const dummy = new THREE.Object3D();
  const geoms = [];
  for (let i = 0; i < PLANE_COUNT; i++) {
    dummy.position.set(
      Math.random() * 1000 - 500,
      -Math.random() * Math.random() * 200 - 15,
      i
    );
    dummy.rotation.z = Math.random() * Math.PI;
    dummy.scale.setScalar(Math.random() * Math.random() * 1.5 + 0.5);
    dummy.updateMatrix();
    const g = base.clone();
    g.applyMatrix4(dummy.matrix);
    geoms.push(g);
  }
  const merged = mergeGeometries(geoms);
  base.dispose();
  geoms.forEach((g) => g.dispose());

  const clouds = new THREE.Mesh(merged, material);
  clouds.renderOrder = 2;
  const cloudsClone = clouds.clone();
  cloudsClone.position.z = -LOOP_LEN;
  cloudsClone.renderOrder = 1;
  scene.add(clouds, cloudsClone);
  scene.add(camera);
  camera.position.z = LOOP_LEN;

  function resize() {
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  window.addEventListener('resize', resize);

  // Mouse parallax (reads pointer globally so the canvas needs no pointer events).
  let mouseX = 0, mouseY = 0;
  if (!prefersReducedMotion) {
    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX - window.innerWidth / 2) * 0.1;
      mouseY = (e.clientY - window.innerHeight / 3) * 0.05;
    }, { passive: true });
  }

  let travelled = 0;
  let last = performance.now();
  let running = false;
  let rafId = 0;
  let boost = 1; // fly-through speed multiplier, driven by scroll velocity

  // Shared with js/three-scene.js and all tweens via GSAP's ticker (one rAF for
  // the whole page). deltaTime arrives in ms; clamp it so a stall doesn't
  // teleport the camera forward through the field.
  const hasGsap = typeof gsap !== 'undefined';

  function tick(time, deltaTime) {
    let dt;
    if (typeof deltaTime === 'number') {
      dt = Math.min(deltaTime, 50) / 1000;
    } else {
      const now = performance.now();
      dt = Math.min(now - last, 50) / 1000;
      last = now;
    }
    // Scroll-velocity boost decays back to 1 on its own, so a flick of the
    // wheel rushes the clouds and they settle again.
    boost += (1 - boost) * Math.min(1, dt * 2.2);
    travelled += dt * DRIFT_SPEED * 500 * boost;
    camera.position.z = -(travelled % LOOP_LEN) + LOOP_LEN;
    camera.position.x += (mouseX - camera.position.x) * 0.01;
    camera.position.y += (-mouseY - camera.position.y) * 0.01;
    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    if (hasGsap) {
      gsap.ticker.add(tick);
    } else {
      const loop = () => { rafId = requestAnimationFrame(loop); tick(); };
      loop();
    }
  }
  function stop() {
    if (!running) return;
    running = false;
    if (hasGsap) gsap.ticker.remove(tick);
    else cancelAnimationFrame(rafId);
  }

  if (prefersReducedMotion) {
    // Calm static sky — render one frame, no animation loop.
    const renderOnce = () => renderer.render(scene, camera);
    renderOnce();
    if (!material.uniforms.map.value) setTimeout(renderOnce, 300);
    console.info('[clouds] static sky (reduced motion).');
    return;
  }

  // Pause the loop whenever the hero scrolls out of view (battery/perf).
  const io = new IntersectionObserver(
    (entries) => { entries[0].isIntersecting ? start() : stop(); },
    { threshold: 0 }
  );
  io.observe(el);

  // Control surface for js/animations.js.
  window.heroClouds = {
    // 1 = idle drift. Clamped so a fast scroll can't fling the camera through
    // the whole field in one frame.
    setBoost(v) {
      boost = Math.max(1, Math.min(9, v));
    },
  };

  console.info('[clouds] fly-through clouds ready.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClouds);
} else {
  initClouds();
}
