import * as THREE from 'three';
import { Batch, makeLabel, piecewise, smooth, Rollers } from '../core/util.js';
import { heatTexture, HEAT_MAX, tiled } from '../core/materials.js';
import { X, TIN_Y, LEHR_Y, RIBBON_W, V_RIBBON } from '../core/layout.js';

// 玻璃带沿程温度（°C）
export const RIBBON_T = [
  [-31.6, 1100], [-30, 1080], [-24, 1010], [-16, 890], [-8, 770], [2, 620], [4, 600], [16, 510], [24, 380], [32, 180], [40, 70], [56, 40],
];

/** 玻璃带宽度：入口铺展 → 拉边机拉薄 → 定型 */
export function ribbonWidth(x) {
  if (x < X.bath0) return 2.4;
  const spread = smooth((x - X.bath0) / 5);
  const pull = smooth((x - -25) / 13);
  return 2.4 + (4.35 - 2.4) * spread - (4.35 - RIBBON_W) * pull;
}
/** 玻璃带厚度（视觉放大） */
export function ribbonThick(x) {
  return piecewise([[-31.6, 0.16], [-30, 0.12], [-25, 0.07], [-12, 0.04], [0, 0.036]], x);
}
/** 玻璃带底面高度：锡槽内浮于锡液面，出口经过渡辊台抬升至退火窑辊道 */
export function ribbonBottom(x) {
  const h = ribbonThick(x);
  const inBath = TIN_Y - h * 0.38;
  return inBath + (LEHR_Y - inBath) * smooth((x - 1.6) / 2.2);
}

function buildRibbonGeometry(xa, xb, step) {
  const xs = [];
  for (let x = xa; x <= xb + 1e-6; x += step) xs.push(x);
  const n = xs.length;
  const pos = [], uv = [], idx = [];
  // 每个截面 8 个顶点：顶面(左右)、底面(左右)、侧面左(上下)、侧面右(上下)
  xs.forEach((x) => {
    const w = ribbonWidth(x) / 2, y0 = ribbonBottom(x), y1 = y0 + ribbonThick(x);
    const u = (x - xa) / (xb - xa);
    pos.push(x, y1, -w, x, y1, w, x, y0, -w, x, y0, w, x, y1, -w, x, y0, -w, x, y1, w, x, y0, w);
    uv.push(u, 0, u, 1, u, 0, u, 1, u, 0, u, 0.1, u, 1, u, 0.9);
  });
  for (let i = 0; i < n - 1; i++) {
    const a = i * 8, b = (i + 1) * 8;
    idx.push(a, a + 1, b, a + 1, b + 1, b); // 顶
    idx.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3); // 底
    idx.push(a + 4, b + 4, a + 5, a + 5, b + 4, b + 5); // 左侧
    idx.push(a + 6, a + 7, b + 6, a + 7, b + 7, b + 6); // 右侧
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** 浮法成形：流道唇砖 → 锡槽（拉边机）→ 过渡辊台 → 退火窑，以及连续玻璃带 */
export function buildFloatLine(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  g.name = 'floatLine';
  const C = (m) => mats.clip(m, 'main');
  const b = new Batch();

  // ---------- 连续玻璃带 ----------
  const ra = -30.2, rb = X.snap;
  const ribbonGeo = buildRibbonGeometry(ra, rb, 0.25);
  const ribbonHeat = heatTexture(RIBBON_T, ra, rb);
  const flowTex = mats.tex.noise.clone();
  flowTex.repeat.set(40, 1);
  flowTex.needsUpdate = true;
  const ribbonMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfeee2,
    roughness: 0.04,
    transmission: 0.85,
    thickness: 0.04,
    ior: 1.52,
    emissive: 0xffffff,
    emissiveMap: ribbonHeat,
    emissiveIntensity: HEAT_MAX,
    transparent: true,
  });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.receiveShadow = true;
  g.add(ribbon);
  // 玻璃带表面"流动感"：极淡的随动纹理
  const sheen = new THREE.Mesh(
    ribbonGeo,
    new THREE.MeshBasicMaterial({ map: flowTex, alphaMap: ribbonHeat, color: new THREE.Color(2.2, 1.0, 0.3), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  sheen.position.y = 0.002;
  g.add(sheen);

  // 唇砖处倾泻而下的玻璃液
  {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-32.1, 1.85, 0), new THREE.Vector3(-30.9, 1.82, 0), new THREE.Vector3(-30.2, ribbonBottom(-30.2) + 0.12, 0));
    const pts = curve.getPoints(16);
    const pos = [], idx = [], uv = [];
    pts.forEach((p, i) => {
      const w = 1.2 + (i / 16) * 0.0;
      pos.push(p.x, p.y, -w, p.x, p.y, w);
      uv.push(0.02, 0, 0.02, 1);
      if (i < 16) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const pour = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x401500, emissive: 0xffffff, emissiveMap: ribbonHeat, emissiveIntensity: HEAT_MAX, side: THREE.DoubleSide }));
    g.add(pour);
    // 唇砖
    b.box(0.6, 0.25, 2.8, C(mats.azs), -30.85, 1.62, 0);
  }

  // ---------- 锡液 ----------
  const tinProfile = [[-30, 1050], [-20, 920], [-10, 800], [2, 620]];
  const tinMat = mats.tin.clone();
  tinMat.emissive.set(0xffffff);
  tinMat.emissiveMap = heatTexture(tinProfile, -30, 2);
  tinMat.emissiveIntensity = HEAT_MAX * 0.18;
  const tinGeo = new THREE.PlaneGeometry(X.bath1 - X.bath0 - 0.4, 6.4);
  tinGeo.rotateX(-Math.PI / 2);
  const tin = new THREE.Mesh(tinGeo, C(tinMat));
  tin.position.set((X.bath0 + X.bath1) / 2, TIN_Y, 0);
  tin.receiveShadow = true;
  g.add(tin);

  // ---------- 锡槽槽体 ----------
  const bx0 = X.bath0, bx1 = X.bath1, bl = bx1 - bx0, bcx = (bx0 + bx1) / 2;
  const steel = C(mats.steelDark);
  const frame = C(mats.steelFrame);
  const seal = C(mats.paintGray);
  b.box(bl, TIN_Y - 0.3, 7.2, C(tiled(mats.refractoryDark, 10, 1)), bcx, (TIN_Y - 0.3) / 2 + 0.3, 0); // 槽底（耐火材料+钢壳）
  b.box(bl + 0.2, 0.35, 7.6, steel, bcx, 0.25, 0);
  for (const zs of [-1, 1]) {
    b.box(bl, 0.5, 0.4, C(tiled(mats.azs, 12, 1)), bcx, TIN_Y + 0.15, zs * 3.4); // 胸墙
    b.box(bl, 0.6, 0.12, seal, bcx, TIN_Y + 0.7, zs * 3.62); // 侧封板
    // 侧封观察孔
    for (let x = bx0 + 1.5; x < bx1; x += 2.5) b.box(0.6, 0.35, 0.05, C(mats.darkGlass), x, TIN_Y + 0.7, zs * 3.69);
  }
  b.box(0.4, 0.8, 7.2, C(tiled(mats.azs, 2, 1)), bx0 - 0.2, TIN_Y + 0.1, 0); // 入口端墙下部
  b.box(0.3, 0.9, 7.2, steel, bx1 + 0.15, TIN_Y + 0.25, 0);
  // 顶盖（吊顶 + 电加热区）
  const roofY = TIN_Y + 1.0;
  b.box(bl + 0.4, 0.45, 7.6, C(tiled(mats.refractory, 12, 2)), bcx, roofY + 0.22, 0);
  b.box(bl + 0.4, 0.15, 7.8, C(mats.insulation), bcx, roofY + 0.52, 0);
  // 顶部钢结构、电加热元件接线柱、保护气体管
  for (let x = bx0 + 0.4; x <= bx1; x += 1.6) {
    b.box(0.25, 0.4, 8.2, frame, x, roofY + 0.8, 0);
    for (const zs of [-1, 1]) b.hColumn(x, 0, roofY + 1.0, zs * 4.0, 0.25, frame, Math.PI / 2);
  }
  for (let x = bx0 + 1.2; x < bx1 - 1; x += 0.8) {
    for (let z = -2.6; z <= 2.6; z += 1.3) b.cyl(0.035, 0.5, C(mats.galv), x, roofY + 0.85, z, 'y', 6);
  }
  for (const z of [-1.95, 1.95]) b.cyl(0.08, bl, C(mats.paintYellow), bcx, roofY + 1.2, z, 'x');
  b.cyl(0.11, bl, C(mats.paintBlue), bcx, roofY + 1.35, 0, 'x'); // N₂+H₂ 保护气总管
  for (let x = bx0 + 2; x < bx1; x += 4) b.rod(new THREE.Vector3(x, roofY + 1.35, 0), new THREE.Vector3(x, roofY + 0.6, 0), 0.05, C(mats.paintBlue), 6);
  // 吊顶下方的电热元件（剖切后发红光）
  for (let x = bx0 + 1.2; x < bx0 + 16; x += 0.8) for (let z = -2.6; z <= 2.6; z += 1.3) b.cyl(0.03, 0.55, C(mats.heater), x, roofY - 0.25, z, 'y', 6);
  // 槽底冷却风管与支撑
  for (let x = bx0 + 1; x < bx1; x += 3) {
    for (const zs of [-1, 1]) b.box(0.3, 0.3, 0.3, steel, x, 0.08, zs * 3.3);
  }
  b.cyl(0.25, bl, mats.galv, bcx, 0.3, -4.2, 'x');

  // ---------- 拉边机（7 对） ----------
  const tops = [];
  const topX = [-26.5, -24, -21.5, -19, -16.5, -14, -11.5];
  for (const x of topX) {
    for (const zs of [-1, 1]) {
      const w = ribbonWidth(x) / 2;
      const head = new THREE.Vector3(x, TIN_Y + ribbonThick(x) + 0.05, zs * (w - 0.12));
      const out = new THREE.Vector3(x + 0.25, TIN_Y + 0.75, zs * 4.4);
      b.rod(out, head, 0.045, mats.chrome, 10); // 水冷杆
      // 机架小车
      b.box(0.5, 0.35, 1.6, mats.paintBlue, x + 0.3, TIN_Y + 0.8, zs * 5.0);
      b.box(0.3, 0.3, 0.5, mats.motor, x + 0.3, TIN_Y + 1.15, zs * 5.5);
      b.box(0.08, TIN_Y + 0.6, 0.08, mats.steelFrame, x + 0.1, (TIN_Y + 0.6) / 2, zs * 4.5);
      b.box(0.08, TIN_Y + 0.6, 0.08, mats.steelFrame, x + 0.5, (TIN_Y + 0.6) / 2, zs * 5.6);
      b.rod(new THREE.Vector3(x + 0.3, TIN_Y + 0.9, zs * 5.8), new THREE.Vector3(x + 0.3, 0.1, zs * 6.0), 0.02, mats.rubber, 5); // 冷却水软管
      // 拉边轮（齿轮状）
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 16), mats.chrome);
      const dir = out.clone().sub(head).normalize();
      wheel.position.copy(head).addScaledVector(dir, 0.04);
      wheel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const pivot = new THREE.Group();
      pivot.add(wheel);
      g.add(pivot);
      tops.push(wheel);
      // 轮齿
      const teeth = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 4, 18), mats.galv);
      teeth.rotation.x = Math.PI / 2;
      wheel.add(teeth);
    }
  }

  // ---------- 过渡辊台（渣箱） ----------
  const lx = X.bath1 + 0.3;
  b.box(1.9, 0.9, 6.2, C(mats.paintGray), lx + 0.9, LEHR_Y + 0.75, 0);
  b.box(1.9, LEHR_Y - 0.25, 6.2, mats.paintGray, lx + 0.9, (LEHR_Y - 0.25) / 2, 0);
  for (const zs of [-1, 1]) b.box(1.9, 0.4, 0.3, mats.motor, lx + 0.9, LEHR_Y, zs * 3.6);

  // ---------- 退火窑 ----------
  const zones = [
    { name: 'A 区', sub: '均热 · 退火上限', x0: 4, x1: 13, T: '600→540°C' },
    { name: 'B 区', sub: '重要退火区', x0: 13, x1: 21, T: '540→480°C' },
    { name: 'C 区', sub: '间接冷却', x0: 21, x1: 27, T: '480→380°C' },
    { name: 'D 区', sub: '热风循环冷却', x0: 27, x1: 33, T: '380→200°C' },
    { name: 'F 区', sub: '强制风冷', x0: 33, x1: 40, T: '200→70°C' },
  ];
  const lehrShell = C(mats.paintGray);
  const lehrIns = C(mats.insulation);
  zones.forEach((zn, i) => {
    const len = zn.x1 - zn.x0 - 0.12, xm = (zn.x0 + zn.x1) / 2;
    const closed = i < 4;
    const h = closed ? 1.25 : 0.7;
    b.box(len, 0.1, 5.6, i < 2 ? lehrIns : lehrShell, xm, LEHR_Y + h, 0);
    for (const zs of [-1, 1]) b.box(len, h + 0.6, 0.1, i < 2 ? lehrIns : lehrShell, xm, LEHR_Y + h / 2 - 0.3, zs * 2.8);
    b.box(len, 0.1, 5.6, lehrShell, xm, LEHR_Y - 0.6, 0);
    // 法兰
    b.box(0.14, h + 0.8, 5.9, C(mats.steelFrame), zn.x0 + 0.07, LEHR_Y + h / 2 - 0.25, 0);
    // 风机（顶置）
    for (let x = zn.x0 + 1.5; x < zn.x1 - 0.5; x += 3) {
      b.cyl(0.45, 0.5, C(mats.paintBlue), x, LEHR_Y + h + 0.3, -1.2);
      b.cyl(0.22, 0.5, C(mats.motor), x, LEHR_Y + h + 0.8, -1.2);
      if (i >= 2) b.box(0.6, 0.35, 2.4, C(mats.galv), x, LEHR_Y + h + 0.25, 0.6);
    }
    // 管道换热器（A/B 区内部可见）
    if (i < 2) for (const z of [-1.4, -0.5, 0.5, 1.4]) b.cyl(0.07, len, C(mats.galv), xm, LEHR_Y + 0.7, z, 'x', 8);
    if (i < 1) for (let x = zn.x0 + 0.5; x < zn.x1; x += 0.6) b.cyl(0.03, 4.4, C(mats.heater), x, LEHR_Y + 0.95, 0, 'z', 6);
    const lbl = makeLabel(zn.name, { sub: zn.sub, temp: zn.T });
    lbl.position.set(xm, LEHR_Y + h + 1.6, 0);
    ctx.addLabel(lbl, 'lehr');
  });
  // 退火窑支腿
  for (let x = X.lehr0 + 0.5; x < X.lehr1; x += 2) for (const zs of [-1, 1]) b.box(0.15, LEHR_Y - 0.6, 0.15, mats.steelFrame, x, (LEHR_Y - 0.6) / 2, zs * 2.7);
  // 控制柜
  for (let x = 8; x < 38; x += 7) {
    b.box(1.6, 2.1, 0.6, mats.paintWhite, x, 1.05, -5.4);
    b.box(0.5, 0.35, 0.02, mats.screen, x - 0.3, 1.5, -5.09);
  }
  b.flush(g);

  // ---------- 辊道（退火窑 + 冷端） ----------
  const rollerPos = [];
  for (let x = X.bath1 + 0.6; x <= X.end + 0.1; x += 0.55) {
    if (x > X.bath1 + 2.3 && x < X.lehr0) continue;
    rollerPos.push({ x, y: LEHR_Y - 0.1, z: 0 });
  }
  const rollers = new Rollers({ positions: rollerPos, length: 4.6, radius: 0.1, material: mats.rollerSteel });
  g.add(rollers.mesh);

  // ---------- 标签 ----------
  const lab = (t, s, x, y, z, st, temp = null) => {
    const l = makeLabel(t, { sub: s, temp });
    l.position.set(x, y, z);
    ctx.addLabel(l, st);
  };
  lab('锡槽', '玻璃液浮在熔融锡液上', -14, TIN_Y + 3.3, 0, 'float', '1100→600°C');
  lab('拉边机', '控制板宽与厚度', -19, TIN_Y + 2.0, 5.2, 'float');
  lab('唇砖 · 摊铺', '玻璃液倾泻到锡面', -30.4, 3.3, 2.8, 'float');
  lab('保护气体', 'N₂ + H₂ 防锡氧化', -4, TIN_Y + 2.6, 0, 'float');
  lab('过渡辊台', '玻璃带抬离锡液', 3.2, LEHR_Y + 2.3, 0, 'float', '~600°C');

  return {
    group: g,
    rollers,
    update(t, dt, sim) {
      flowTex.offset.x -= (dt * V_RIBBON) / (rb - ra) * 40;
      for (const w of tops) w.rotateY(dt * 4);
      rollers.update(dt, (x) => (x < X.snap ? V_RIBBON : x < X.pick - 1.5 ? V_RIBBON * 1.6 : 0));
    },
  };
}

