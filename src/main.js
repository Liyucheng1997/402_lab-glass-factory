import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import './style.css';
import { createMaterials } from './core/materials.js';
import { makeLabel, easeInOut } from './core/util.js';
import { Z_TEMPER, Z_BOTTLE } from './core/layout.js';
import { buildBuilding } from './factory/building.js';
import { buildBatchHouse } from './factory/batchHouse.js';
import { buildFurnace } from './factory/furnace.js';
import { buildFloatLine } from './factory/floatLine.js';
import { buildColdEnd } from './factory/coldEnd.js';
import { buildTemperingLine } from './factory/temperingLine.js';
import { buildBottleLine } from './factory/bottleLine.js';
import { STATIONS } from './data/stations.js';
import { createUI } from './ui.js';

/* ---------------- 渲染器与场景 ---------------- */
const host = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.localClippingEnabled = true;
host.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(host.clientWidth, host.clientHeight);
labelRenderer.domElement.className = 'label-layer';
host.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;

const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 1500);
camera.position.set(-4, 110, 138);
const controls = new OrbitControls(camera, labelRenderer.domElement);
controls.target.set(-12, 0, -4);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 2.5;
controls.maxDistance = 300;
controls.screenSpacePanning = true;

// 光照
const hemi = new THREE.HemisphereLight(0xe3ebf4, 0x8b857c, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e6, 2.3);
sun.position.set(70, 130, 90);
sun.target.position.set(-10, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -125, right: 125, top: 80, bottom: -80, near: 10, far: 400 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

// 剖切平面：保留 z ≤ c 的一半，c 远大时等于关闭
const OFF = 1e4;
const clip = {
  main: new THREE.Plane(new THREE.Vector3(0, 0, -1), OFF),
  temper: new THREE.Plane(new THREE.Vector3(0, 0, -1), OFF),
  bottle: new THREE.Plane(new THREE.Vector3(0, 0, -1), OFF),
};
const CUT = { main: 0, temper: Z_TEMPER, bottle: Z_BOTTLE };

const mats = createMaterials(clip);
const labels = [];
const ctx = {
  scene,
  mats,
  addLabel(obj, station) {
    obj.userData.station = obj.userData.station ?? station;
    labels.push(obj);
    scene.add(obj);
  },
};

const modules = [buildBuilding, buildBatchHouse, buildFurnace, buildFloatLine, buildColdEnd, buildTemperingLine, buildBottleLine].map((f) => {
  const m = f(ctx);
  scene.add(m.group);
  return m;
});

// 工位总标签
const STATION_TAG = {
  batch: [-91, 19, -2.5],
  furnace: [-54, 10.5, 0],
  float: [-14, 6.4, 0],
  lehr: [22, 6, 0],
  cold: [58, 6.6, 0],
  edging: [-11, 5.5, 28],
  temper: [16, 6.6, 28],
  bottle: [-35, 10.5, -30],
  bottleQC: [-8, 6.2, -33],
};
STATIONS.forEach((s) => {
  if (!STATION_TAG[s.id]) return;
  const l = makeLabel(s.name, { kind: 'station', sub: s.no, station: s.id });
  l.position.set(...STATION_TAG[s.id]);
  l.element.addEventListener('click', () => ui.select(s.id));
  ctx.addLabel(l, s.id);
});

/* ---------------- 后期：泛光 ---------------- */
const rt = new THREE.WebGLRenderTarget(host.clientWidth, host.clientHeight, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), 0.55, 0.5, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------------- 状态 ---------------- */
const sim = { t: 240, speed: 1, paused: false, cutaway: false, stress: false, labels: true, night: false, tour: false };

function applyCut() {
  for (const k of Object.keys(clip)) clip[k].constant = sim.cutaway ? CUT[k] : OFF;
}
function applyTheme() {
  const n = sim.night;
  document.documentElement.dataset.theme = n ? 'dark' : 'light';
  scene.background = new THREE.Color(n ? 0x07090d : 0xdde4ec);
  scene.fog = new THREE.Fog(n ? 0x07090d : 0xdde4ec, 180, 520);
  hemi.intensity = n ? 0.22 : 0.95;
  sun.intensity = n ? 0.25 : 1.9;
  sun.color.set(n ? 0x9fb4ff : 0xfff4e6);
  scene.environmentIntensity = n ? 0.12 : 0.5;
  bloom.strength = n ? 0.7 : 0.4;
  bloom.threshold = n ? 0.55 : 0.85;
  bloom.radius = 0.45;
}

/* ---------------- 相机飞行 ---------------- */
let fly = null;
function flyTo(pos, target, dur = 1.8) {
  fly = {
    p0: camera.position.clone(),
    t0: controls.target.clone(),
    p1: new THREE.Vector3(...pos),
    t1: new THREE.Vector3(...target),
    start: performance.now(),
    dur: dur * 1000,
  };
}
controls.addEventListener('start', () => {
  fly = null;
  if (sim.tour) ui.setTour(false);
});

/* ---------------- UI ---------------- */
const ui = createUI({
  stations: STATIONS,
  sim,
  onSelect(st) {
    flyTo(st.cam.pos, st.cam.target);
    // 炉窑类工位默认打开剖切，便于看到内部
    ui.setToggle('cutaway', !!st.cut);
  },
  onToggle(key) {
    if (key === 'cutaway') applyCut();
    if (key === 'night') applyTheme();
  },
});
applyTheme();
applyCut();

/* ---------------- 循环 ---------------- */
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
let tourTimer = 0;
function frame() {
  const rdt = Math.min(clock.getDelta(), 0.05);
  const dt = sim.paused ? 0 : rdt * sim.speed;
  sim.t += dt;
  for (const m of modules) m.update?.(sim.t, dt, sim);

  if (fly) {
    const u = Math.min(1, (performance.now() - fly.start) / fly.dur);
    const e = easeInOut(u);
    camera.position.lerpVectors(fly.p0, fly.p1, e);
    // 飞行途中略微抬高，避免穿过设备
    camera.position.y += Math.sin(u * Math.PI) * fly.p0.distanceTo(fly.p1) * 0.12;
    controls.target.lerpVectors(fly.t0, fly.t1, e);
    if (u >= 1) fly = null;
  }
  controls.update();

  if (sim.tour) {
    tourTimer += rdt;
    if (tourTimer > 15) {
      tourTimer = 0;
      ui.next();
    }
  } else tourTimer = 0;

  // 相机高于屋架时隐藏屋顶，便于俯瞰
  modules[0].roof.visible = camera.position.y < 9;

  // 标签：近处显示部件标签，远处显示工位标签
  for (const l of labels) {
    const d = camera.position.distanceTo(l.getWorldPosition(tmp));
    const isStation = l.userData.kind === 'station';
    l.visible = sim.labels && (isStation ? d > 16 : d < 36);
  }

  composer.render();
  labelRenderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/** 让相机注视点落在左右两块面板之间的可见区域中央 */
function updateViewOffset() {
  const w = host.clientWidth, h = host.clientHeight;
  const wide = window.innerWidth > 760;
  const nav = document.getElementById('stations');
  const info = document.getElementById('info');
  const left = wide ? nav.offsetLeft + nav.offsetWidth : 0;
  const right = wide && !document.body.classList.contains('info-collapsed') ? window.innerWidth - info.offsetLeft : 0;
  camera.setViewOffset(w, h, (right - left) / 2, 0, w, h);
}
new MutationObserver(updateViewOffset).observe(document.body, { attributes: true, attributeFilter: ['class'] });

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  camera.aspect = w / h;
  updateViewOffset();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
}
window.addEventListener('resize', resize);
updateViewOffset();

requestAnimationFrame(() => {
  frame();
  document.body.classList.add('ready');
});

// 调试入口
window.__factory = { scene, camera, controls, sim, renderer, flyTo, composer, ui };
