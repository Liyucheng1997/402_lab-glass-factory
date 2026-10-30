import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
/** 0→1 over [a,b] with smoothstep */
export const phase = (t, a, b) => smooth((t - a) / (b - a));
export const mod = (a, n) => ((a % n) + n) % n;

/** 分段线性插值，points = [[x, y], ...] 按 x 升序 */
export function piecewise(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return points[points.length - 1][1];
}

/** 可复现伪随机 */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mesh(geo, mat, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function boxMesh(w, h, d, mat, x = 0, y = 0, z = 0, opts) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, opts);
}

const _up = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();

/**
 * 静态几何合批：同材质的零件合并为一个网格，大幅减少绘制调用。
 */
export class Batch {
  constructor() {
    this.map = new Map();
  }
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    return this.addMatrix(geo, mat, _m);
  }
  addMatrix(geo, mat, matrix) {
    const g = (geo.index ? geo : geo).clone();
    g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const list = this.map.get(mat) || [];
    list.push(g.index ? g.toNonIndexed() : g);
    this.map.set(mat, list);
    return this;
  }
  box(w, h, d, mat, x, y, z, ry = 0) {
    return this.add(BOX, mat, x, y, z, 0, ry, 0, w, h, d);
  }
  /** 圆柱，axis = 'x' | 'y' | 'z' */
  cyl(r, len, mat, x, y, z, axis = 'y', seg = 16) {
    const g = cylGeo(seg);
    const rx = axis === 'z' ? Math.PI / 2 : 0;
    const rz = axis === 'x' ? Math.PI / 2 : 0;
    return this.add(g, mat, x, y, z, rx, 0, rz, r, len, r);
  }
  /** 两点之间的圆柱（管道、拉杆、斜撑） */
  rod(a, b, r, mat, seg = 8) {
    const dir = _p.copy(b).sub(a);
    const len = dir.length();
    _q.setFromUnitVectors(_up, dir.normalize());
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    _m.compose(mid, _q, _s.set(r, len, r));
    return this.addMatrix(cylGeo(seg), mat, _m);
  }
  /** 方管/型钢：两点之间的方截面杆件 */
  beam(a, b, w, h, mat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    _q.setFromUnitVectors(_up, dir.normalize());
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    _m.compose(mid, _q, _s.set(w, len, h));
    return this.addMatrix(BOX, mat, _m);
  }
  /** H 型钢立柱 */
  hColumn(x, y0, y1, z, size, mat, ry = 0) {
    const h = y1 - y0;
    const y = (y0 + y1) / 2;
    const f = size * 0.08;
    const c = Math.cos(ry), s = Math.sin(ry);
    // 两翼缘 + 腹板
    this.add(BOX, mat, x + s * (size / 2 - f / 2), y, z + c * (size / 2 - f / 2), 0, ry, 0, size, h, f);
    this.add(BOX, mat, x - s * (size / 2 - f / 2), y, z - c * (size / 2 - f / 2), 0, ry, 0, size, h, f);
    this.add(BOX, mat, x, y, z, 0, ry, 0, f, h, size);
    return this;
  }
  flush(parent, { cast = true, receive = true } = {}) {
    for (const [mat, list] of this.map) {
      const geo = mergeGeometries(list, false);
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cast;
      m.receiveShadow = receive;
      parent.add(m);
    }
    this.map.clear();
    return parent;
  }
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const _cylCache = new Map();
function cylGeo(seg) {
  if (!_cylCache.has(seg)) _cylCache.set(seg, new THREE.CylinderGeometry(1, 1, 1, seg));
  return _cylCache.get(seg);
}

/** 旋转辊道：InstancedMesh 实现，按线速度滚动 */
export class Rollers {
  constructor({ positions, length, radius, material, axis = 'z' }) {
    const geo = new THREE.CylinderGeometry(radius, radius, length, 18);
    if (axis === 'z') geo.rotateX(Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, material, positions.length);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.positions = positions;
    this.radius = radius;
    this.angles = new Float32Array(positions.length);
    this.dummy = new THREE.Object3D();
    this.update(0, () => 0);
  }
  /** speedAt(x) 返回该处线速度（m/s） */
  update(dt, speedAt) {
    const d = this.dummy;
    for (let i = 0; i < this.positions.length; i++) {
      const p = this.positions[i];
      this.angles[i] -= (speedAt(p.x, i) * dt) / this.radius;
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(0, 0, this.angles[i]);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** 三维标签 */
export function makeLabel(title, { sub = '', kind = 'part', station = null, temp = null } = {}) {
  const el = document.createElement('div');
  el.className = `tag tag-${kind}`;
  if (kind === 'station') {
    el.innerHTML = `<span class="tag-no">${sub}</span><span class="tag-title">${title}</span>`;
  } else {
    el.innerHTML = `<span class="tag-title">${title}</span>${sub ? `<span class="tag-sub">${sub}</span>` : ''}`;
  }
  if (temp != null) el.insertAdjacentHTML('beforeend', `<span class="tag-temp">${temp}</span>`);
  const obj = new CSS2DObject(el);
  obj.userData = { kind, station };
  return obj;
}

/** 简单工人模型：用于体现尺度 */
export function makeWorker(mats, vest = 'orange') {
  const g = new THREE.Group();
  const b = new Batch();
  const legs = mats.workerPants;
  b.box(0.16, 0.85, 0.2, legs, -0.11, 0.425, 0);
  b.box(0.16, 0.85, 0.2, legs, 0.11, 0.425, 0);
  b.box(0.48, 0.62, 0.26, vest === 'orange' ? mats.workerVest : mats.workerBlue, 0, 1.17, 0);
  b.box(0.12, 0.58, 0.14, mats.workerBlue, -0.31, 1.15, 0);
  b.box(0.12, 0.58, 0.14, mats.workerBlue, 0.31, 1.15, 0);
  b.add(new THREE.SphereGeometry(0.13, 14, 10), mats.skin, 0, 1.64, 0);
  b.add(new THREE.SphereGeometry(0.155, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.helmet, 0, 1.68, 0);
  b.flush(g);
  return g;
}
