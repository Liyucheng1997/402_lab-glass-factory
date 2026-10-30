import * as THREE from 'three';
import { rng, piecewise } from './util.js';

/* ---------------- 程序化贴图 ---------------- */
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function concreteCanvas(base = '#9b9a95', seed = 3) {
  const [c, g] = canvas(1024, 1024);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 60; i++) {
    const x = r() * 1024, y = r() * 1024, rad = 60 + r() * 220;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() > 0.5;
    grd.addColorStop(0, dark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 1024);
  }
  for (let i = 0; i < 26000; i++) {
    const v = r() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${0.04 + r() * 0.08})`;
    g.fillRect(r() * 1024, r() * 1024, 1 + r() * 2, 1 + r() * 2);
  }
  // 伸缩缝
  g.strokeStyle = 'rgba(40,40,40,0.35)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 1024, 1024);
  return c;
}

function brickCanvas({ base = [185, 165, 138], mortar = '#7d7366', rows = 8, cols = 4, seed = 7, soot = 0 }) {
  const [c, g] = canvas(512, 512);
  const r = rng(seed);
  g.fillStyle = mortar;
  g.fillRect(0, 0, 512, 512);
  const bh = 512 / rows, bw = 512 / cols;
  for (let row = 0; row < rows; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < cols + 1; col++) {
      const k = 0.86 + r() * 0.22;
      const [cr, cg, cb] = base.map((v) => Math.min(255, v * k));
      g.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`;
      g.fillRect(col * bw + off + 3, row * bh + 3, bw - 6, bh - 6);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(0,0,0,${r() * 0.07})`;
        g.fillRect(col * bw + off + r() * bw, row * bh + r() * bh, 2 + r() * 5, 2 + r() * 3);
      }
    }
  }
  if (soot) {
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, `rgba(30,25,20,${soot})`);
    grd.addColorStop(1, 'rgba(30,25,20,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
  }
  return c;
}

function stripeCanvas() {
  const [c, g] = canvas(128, 8);
  g.fillStyle = '#d9dcdf';
  g.fillRect(0, 0, 128, 8);
  g.fillStyle = '#5d6369';
  g.fillRect(0, 0, 18, 8);
  g.fillRect(64, 0, 6, 8);
  return c;
}

function hazardCanvas() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#f2c230';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#222';
  for (let i = -128; i < 256; i += 48) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 24, 0);
    g.lineTo(i + 24 + 128, 128);
    g.lineTo(i + 128, 128);
    g.fill();
  }
  return c;
}

function noiseCanvas(seed = 11, size = 256, blobs = 220) {
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < blobs; i++) {
    const x = r() * size, y = r() * size, rad = 4 + r() * 26;
    for (const dx of [-size, 0, size])
      for (const dy of [-size, 0, size]) {
        const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
        grd.addColorStop(0, `rgba(255,255,255,${0.15 + r() * 0.25})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd;
        g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
      }
  }
  return c;
}

function gratingCanvas() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#3c4045';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#7b8086';
  for (let i = 0; i < 128; i += 16) g.fillRect(i, 0, 3, 128);
  for (let i = 0; i < 128; i += 32) g.fillRect(0, i, 128, 2);
  return c;
}

function corrugatedCanvas(color = '#b8bec5') {
  const [c, g] = canvas(256, 64);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 256; i += 16) {
    const grd = g.createLinearGradient(i, 0, i + 16, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0.12)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = grd;
    g.fillRect(i, 0, 16, 64);
  }
  return c;
}

/* ---------------- 炽热玻璃的发光色 ---------------- */
// 线性 HDR 色值：玻璃约 480°C 开始可见暗红辉光，温度越高越趋向黄白
const HEAT = [
  [20, 0, 0, 0],
  [470, 0, 0, 0],
  [540, 0.07, 0.003, 0],
  [620, 0.26, 0.018, 0],
  [700, 0.46, 0.05, 0.003],
  [850, 0.65, 0.12, 0.01],
  [1000, 0.85, 0.21, 0.022],
  [1200, 1.1, 0.33, 0.045],
  [1400, 1.32, 0.47, 0.085],
  [1600, 1.55, 0.66, 0.16],
];
export const HEAT_MAX = 1.55;
export function heatColor(T, out = new THREE.Color()) {
  const ch = (i) => piecewise(HEAT.map((s) => [s[0], s[i]]), T);
  return out.setRGB(ch(1), ch(2), ch(3));
}

/** 沿 u 方向的温度剖面贴图，配合 emissiveIntensity = HEAT_MAX 使用 */
export function heatTexture(profile, u0, u1, width = 1024) {
  const data = new Uint8Array(width * 4);
  const c = new THREE.Color();
  for (let i = 0; i < width; i++) {
    const x = u0 + ((u1 - u0) * i) / (width - 1);
    heatColor(piecewise(profile, x), c);
    data[i * 4] = Math.min(255, (c.r / HEAT_MAX) * 255);
    data[i * 4 + 1] = Math.min(255, (c.g / HEAT_MAX) * 255);
    data[i * 4 + 2] = Math.min(255, (c.b / HEAT_MAX) * 255);
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, width, 1);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/* ---------------- 材质库 ---------------- */
export function createMaterials(clip) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const T = {
    concrete: tex(concreteCanvas(), { repeat: [30, 14] }),
    ground: tex(concreteCanvas('#6f6f6b', 9), { repeat: [60, 60] }),
    refractory: tex(brickCanvas({}), { repeat: [1, 1] }),
    refractoryDark: tex(brickCanvas({ base: [150, 128, 108], mortar: '#5e554c', seed: 5, soot: 0.35 }), { repeat: [1, 1] }),
    azs: tex(brickCanvas({ base: [214, 206, 192], mortar: '#9d968b', rows: 4, cols: 2, seed: 9 })),
    redBrick: tex(brickCanvas({ base: [150, 78, 58], mortar: '#8a8178', rows: 16, cols: 6, seed: 2 })),
    stripe: tex(stripeCanvas(), { repeat: [1, 1] }),
    hazard: tex(hazardCanvas(), { repeat: [4, 1] }),
    noise: tex(noiseCanvas(), { repeat: [3, 1.2], srgb: false }),
    grating: tex(gratingCanvas(), { repeat: [10, 2] }),
    cladding: tex(corrugatedCanvas(), { repeat: [8, 1] }),
  };

  const M = {
    tex: T,
    floor: std({ map: T.concrete, roughness: 0.92, metalness: 0 }),
    ground: std({ map: T.ground, roughness: 1, color: 0x9a9a9a }),
    lineYellow: std({ color: 0xe8b923, roughness: 0.7 }),
    lineWhite: std({ color: 0xe9e9e6, roughness: 0.7 }),
    plinth: std({ color: 0xb4b2ac, roughness: 0.9 }),

    steelDark: std({ color: 0x3b4148, roughness: 0.55, metalness: 0.6 }),
    steelFrame: std({ color: 0x5f7083, roughness: 0.5, metalness: 0.45 }),
    galv: std({ color: 0xa9afb5, roughness: 0.38, metalness: 0.85 }),
    chrome: std({ color: 0xe1e4e8, roughness: 0.12, metalness: 1 }),
    paintGray: std({ color: 0xb4bbc2, roughness: 0.55, metalness: 0.2 }),
    paintWhite: std({ color: 0xdadde0, roughness: 0.55, metalness: 0.1 }),
    paintBlue: std({ color: 0x2c5b8c, roughness: 0.45, metalness: 0.2 }),
    paintGreen: std({ color: 0x3f7d5a, roughness: 0.5, metalness: 0.15 }),
    paintYellow: std({ color: 0xe5b220, roughness: 0.5, metalness: 0.1 }),
    paintOrange: std({ color: 0xd9692a, roughness: 0.5, metalness: 0.1 }),
    paintRed: std({ color: 0xb8322a, roughness: 0.5, metalness: 0.1 }),
    motor: std({ color: 0x35608f, roughness: 0.4, metalness: 0.35 }),
    rubber: std({ color: 0x1d1f22, roughness: 0.85 }),
    belt: std({ color: 0x2a2c2f, roughness: 0.9 }),
    cladding: std({ map: T.cladding, roughness: 0.5, metalness: 0.4 }),
    insulation: std({ color: 0xd2d5d8, roughness: 0.4, metalness: 0.7 }),
    grating: std({ map: T.grating, roughness: 0.6, metalness: 0.5 }),
    hazard: std({ map: T.hazard, roughness: 0.6 }),
    rollerSteel: std({ map: T.stripe, roughness: 0.35, metalness: 0.75 }),
    rollerCeramic: std({ color: 0xf1ede4, roughness: 0.6 }),
    redBrick: std({ map: T.redBrick, roughness: 0.95 }),
    tin: std({ color: 0xc9ced3, roughness: 0.08, metalness: 1, emissive: 0x3a0e00, emissiveIntensity: 1 }),
    darkGlass: std({ color: 0x1c2a33, roughness: 0.1, metalness: 0.3 }),
    screen: std({ color: 0x0b1a2a, emissive: 0x2b7fd6, emissiveIntensity: 0.9, roughness: 0.3 }),
    lampWhite: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 3.8) }),
    lampRed: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.15, 0.1) }),
    lampGreen: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 3, 0.6) }),
    heater: new THREE.MeshStandardMaterial({ color: 0x331100, emissive: new THREE.Color(2.4, 0.7, 0.12), roughness: 0.6 }),
    batch: std({ color: 0xe8e2d2, roughness: 1 }),
    sand: std({ color: 0xd9c9a3, roughness: 1 }),
    cullet: std({ color: 0x9fd0c0, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }),

    workerPants: std({ color: 0x2b3a4f, roughness: 0.9 }),
    workerBlue: std({ color: 0x2f5f9e, roughness: 0.85 }),
    workerVest: std({ color: 0xf26b1d, roughness: 0.8 }),
    skin: std({ color: 0xe0b48f, roughness: 0.8 }),
    helmet: std({ color: 0xf5c518, roughness: 0.35 }),

    // 透明平板玻璃（浮法原片：边部微带绿色）
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xcfeee3,
      roughness: 0.02,
      metalness: 0,
      transmission: 0.82,
      thickness: 0.35,
      ior: 1.52,
      attenuationColor: new THREE.Color(0x4f9e85),
      attenuationDistance: 0.5,
      transparent: true,
      opacity: 1,
      envMapIntensity: 1.6,
      specularIntensity: 1,
    }),
    glassEdge: std({ color: 0x5fae95, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9 }),
    windowGlass: new THREE.MeshPhysicalMaterial({ color: 0xbcd6e6, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.6 }),
  };

  // 剖切材质：同一材质在不同产线上使用各自的剖切平面
  const cache = new Map();
  M.clip = (mat, line = 'main') => {
    const key = mat.uuid + line;
    if (!cache.has(key)) {
      const m = mat.clone();
      m.clippingPlanes = [clip[line]];
      m.clipShadows = true;
      m.side = THREE.DoubleSide;
      cache.set(key, m);
    }
    return cache.get(key);
  };
  M.refractory = std({ map: T.refractory, roughness: 0.95 });
  M.refractoryDark = std({ map: T.refractoryDark, roughness: 0.95 });
  M.azs = std({ map: T.azs, roughness: 0.85 });
  return M;
}

/** 平铺贴图在不同尺寸物体上的重复：克隆材质并设置 repeat */
export function tiled(mat, rx, ry) {
  const m = mat.clone();
  if (mat.map) {
    m.map = mat.map.clone();
    m.map.repeat.set(rx, ry);
    m.map.needsUpdate = true;
  }
  return m;
}
