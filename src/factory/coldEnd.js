import * as THREE from 'three';
import { Batch, makeLabel, mod, easeInOut, lerp, clamp } from '../core/util.js';
import { X, LEHR_Y, V_RIBBON, CUT_PERIOD as P, PLATE_L, PLATE_W, RIBBON_W } from '../core/layout.js';

const TH = 0.03; // 板厚（视觉）
const SCORE_T = 1.0; // 横切划线时间
const D = (X.snap - X.cut) / V_RIBBON; // 划线到掰断的时间
const V2 = V_RIBBON * 1.6; // 掰断后加速辊道
const A_TRIM = (X.trim - PLATE_L / 2 - X.snap) / V2;
const A_ARR = (X.pick - PLATE_L / 2 - X.snap) / V2;
const HINGE_Z = -PLATE_W / 2;
const Z_RACK = -4.6;
const RACK_N = 16;
const STRIP = (RIBBON_W - PLATE_W) / 2;

/** 冷端：在线检测、横切/纵切、掰断、切边、堆垛；碎玻璃回收至原料车间 */
export function buildColdEnd(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  g.name = 'coldEnd';
  const b = new Batch();
  const topY = LEHR_Y + 0.036;

  // 辊道机架
  for (const zs of [-1, 1]) b.box(X.end - X.lehr1, 0.25, 0.18, mats.paintBlue, (X.end + X.lehr1) / 2, LEHR_Y - 0.25, zs * 2.4);
  for (let x = X.lehr1 + 0.5; x < X.end; x += 2) {
    for (const zs of [-1, 1]) b.box(0.15, LEHR_Y - 0.35, 0.15, mats.steelFrame, x, (LEHR_Y - 0.35) / 2, zs * 2.4);
    b.box(0.6, 0.35, 0.3, mats.motor, x, LEHR_Y - 0.25, 2.75);
  }

  // ---- 在线缺陷检测 ----
  const xi = X.inspect;
  for (const zs of [-1, 1]) b.box(0.3, 3.0, 0.3, mats.paintWhite, xi, 1.5, zs * 3.0);
  b.box(0.5, 0.5, 6.4, mats.paintWhite, xi, 3.1, 0);
  for (let z = -1.75; z <= 1.76; z += 0.7) {
    b.box(0.25, 0.3, 0.25, mats.steelDark, xi, 2.7, z);
    b.cyl(0.06, 0.12, mats.darkGlass, xi, 2.5, z);
  }
  b.box(0.3, 0.12, 4.2, mats.lampWhite, xi + 0.15, LEHR_Y - 0.35, 0); // 底部线光源
  b.box(0.03, 0.01, 3.9, mats.lampRed, xi, topY + 0.004, 0); // 扫描线
  b.box(0.9, 1.9, 0.6, mats.paintWhite, xi, 0.95, -4.0);
  b.box(0.6, 0.4, 0.02, mats.screen, xi, 1.4, -3.69);

  // ---- 横切桥（斜置） ----
  const bridgeAng = Math.atan2(V_RIBBON * SCORE_T, 3.9);
  const bridgeX = (z) => X.cut + (V_RIBBON * SCORE_T * (z + 1.95)) / 3.9;
  const bcx = bridgeX(0);
  b.add(new THREE.BoxGeometry(0.35, 0.45, 6.6), mats.paintYellow, bcx, 2.45, 0, 0, bridgeAng, 0);
  b.add(new THREE.BoxGeometry(0.08, 0.08, 6.4), mats.chrome, bcx - 0.2 * Math.cos(bridgeAng), 2.3, 0.2 * Math.sin(bridgeAng), 0, bridgeAng, 0);
  for (const z of [-3.1, 3.1]) {
    b.box(0.3, 2.45, 0.3, mats.paintYellow, bridgeX(z), 1.22, z);
    b.box(0.7, 0.1, 0.7, mats.steelDark, bridgeX(z), 0.05, z);
  }
  b.box(0.5, 0.5, 0.5, mats.motor, bridgeX(3.1), 2.95, 3.1);
  // ---- 纵切刀桥 ----
  b.box(0.3, 0.3, 6.0, mats.paintYellow, X.longCut, 2.3, 0);
  for (const zs of [-1, 1]) {
    b.box(0.25, 2.3, 0.25, mats.paintYellow, X.longCut, 1.15, zs * 3.0);
    b.box(0.22, 0.6, 0.22, mats.paintGray, X.longCut, 1.85, zs * PLATE_W / 2);
    b.rod(new THREE.Vector3(X.longCut, 1.55, (zs * PLATE_W) / 2), new THREE.Vector3(X.longCut, topY + 0.06, (zs * PLATE_W) / 2), 0.025, mats.chrome, 6);
    b.cyl(0.05, 0.015, mats.chrome, X.longCut, topY + 0.05, (zs * PLATE_W) / 2, 'z', 14);
    // 纵向划痕（掰断前）
    b.box(X.snap - X.longCut, 0.003, 0.012, mats.steelDark, (X.snap + X.longCut) / 2, topY + 0.002, (zs * PLATE_W) / 2);
  }
  // ---- 掰边、碎玻璃料斗、破碎机 ----
  for (const zs of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(1.4, 0.45, 1.0, 4, 1, true), mats.paintGreen, X.trim + 1.2, 0.55, zs * 2.9, 0, Math.PI / 4, 0);
    b.box(1.2, 0.5, 1.2, mats.paintGreen, X.trim + 1.2, 0.25, zs * 2.9);
    b.cyl(0.07, 1.2, mats.chrome, X.trim, LEHR_Y + 0.1, zs * (PLATE_W / 2 + 0.2), 'x');
  }
  // 横向碎玻璃皮带 → 回收总皮带
  const cz0 = 2.9, cz1 = -12;
  b.box(0.8, 0.06, cz0 - cz1, mats.belt, X.trim + 1.2, 0.32, (cz0 + cz1) / 2);
  const recX0 = X.trim + 1.2, recX1 = -84;
  b.box(recX0 - recX1, 0.06, 0.8, mats.belt, (recX0 + recX1) / 2, 0.62, cz1);
  for (const dz of [-0.45, 0.45]) b.box(recX0 - recX1, 0.25, 0.06, mats.paintGray, (recX0 + recX1) / 2, 0.6, cz1 + dz);
  for (let x = recX1; x < recX0; x += 3) b.box(0.08, 0.5, 0.9, mats.steelFrame, x, 0.25, cz1);
  b.add(new THREE.BoxGeometry(5.6, 0.06, 0.8), mats.belt, recX1 - 2.4, 1.6, cz1 + 0.0, 0, 0, -0.38);
  b.flush(g);

  // ---- 堆垛：翻转台 + A 字架 ----
  const sb = new Batch();
  for (const dx of [-1.0, 1.0]) {
    const x = X.pick + dx;
    const zf = Z_RACK - 0.04;
    sb.beam(new THREE.Vector3(x, 0.5, zf), new THREE.Vector3(x, 3.95, zf - 0.3), 0.12, 0.12, mats.paintBlue);
    sb.beam(new THREE.Vector3(x, 0.5, zf - 1.2), new THREE.Vector3(x, 3.95, zf - 0.3), 0.12, 0.12, mats.paintBlue);
    sb.box(0.14, 0.14, 1.8, mats.paintBlue, x, 0.45, zf - 0.2);
    sb.box(0.16, 0.08, 1.0, mats.rubber, x, 0.53, zf + 0.45);
  }
  sb.box(2.4, 0.18, 2.2, mats.steelDark, X.pick, 0.3, Z_RACK - 0.3);
  sb.box(2.2, 0.12, 0.12, mats.paintBlue, X.pick, 3.4, Z_RACK - 0.3);
  sb.box(0.6, 0.6, 0.6, mats.motor, X.pick + 1.8, 0.6, HINGE_Z - 0.6);
  sb.flush(g);

  // 翻转台框架（带吸盘），绕板边铰轴旋转
  const tilt = new THREE.Group();
  tilt.position.set(X.pick, LEHR_Y - 0.06, HINGE_Z);
  const tb = new Batch();
  for (const dx of [-1.2, 0, 1.2]) tb.box(0.1, 0.1, PLATE_W, mats.paintOrange, dx, 0, PLATE_W / 2);
  tb.box(2.6, 0.1, 0.1, mats.paintOrange, 0, 0, 0.1);
  tb.box(2.6, 0.1, 0.1, mats.paintOrange, 0, 0, PLATE_W - 0.2);
  for (const dx of [-1.2, 0, 1.2]) for (const dz of [0.5, 1.65, 2.8]) tb.cyl(0.08, 0.06, mats.rubber, dx, 0.06, dz, 'y', 12);
  tb.flush(tilt);
  g.add(tilt);
  b.cyl(0.12, 2.8, mats.chrome, X.pick, LEHR_Y - 0.06, HINGE_Z, 'x');
  b.flush(g);

  // ---- 玻璃板对象池 ----
  const POOL = 28;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const pool = [];
  for (let i = 0; i < POOL; i++) {
    const pivot = new THREE.Group();
    const body = new THREE.Group();
    const core = new THREE.Mesh(unit, mats.glass);
    core.scale.set(PLATE_L, TH, PLATE_W);
    body.add(core);
    const strips = [-1, 1].map((zs) => {
      const s = new THREE.Mesh(unit, mats.glass);
      s.scale.set(PLATE_L, TH, STRIP - 0.01);
      s.position.z = zs * (PLATE_W / 2 + STRIP / 2);
      body.add(s);
      return s;
    });
    body.position.set(0, TH / 2, PLATE_W / 2);
    pivot.add(body);
    pivot.visible = false;
    g.add(pivot);
    pool.push({ pivot, body, core, strips });
  }

  // 横切划痕
  const lines = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(unit, mats.steelDark);
    g.add(m);
    return m;
  });
  // 切割头
  const head = new THREE.Group();
  const hb = new Batch();
  hb.box(0.5, 0.45, 0.4, mats.paintGray, 0, 0.45, 0);
  hb.box(0.2, 0.2, 0.2, mats.motor, 0, 0.78, 0.1);
  hb.cyl(0.035, 0.35, mats.chrome, 0, 0.1, 0);
  hb.cyl(0.05, 1.5, mats.chrome, 0, 1.4, 0);
  hb.cyl(0.045, 0.012, mats.chrome, 0, -0.08, 0, 'x', 14);
  hb.flush(head);
  g.add(head);
  // 掰断辊
  const snapRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.2, 16).rotateX(Math.PI / 2), mats.rubber);
  snapRoll.position.set(X.snap + 0.1, LEHR_Y - 0.09, 0);
  g.add(snapRoll);

  // 碎玻璃颗粒（回收皮带）
  const nCul = 260;
  const cul = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.13, 0), mats.cullet, nCul);
  g.add(cul);
  const pathLen = (cz0 - cz1) + (recX0 - recX1);

  // ---- 标签 ----
  const lab = (t, s, x, y, z, st = 'cold') => {
    const l = makeLabel(t, { sub: s });
    l.position.set(x, y, z);
    ctx.addLabel(l, st);
  };
  lab('在线缺陷检测', '气泡 · 结石 · 划伤', xi, 4.0, 0);
  lab('横切桥', '斜向行走 · 垂直划线', bcx, 3.5, -1.5);
  lab('纵切刀', '切除毛边', X.longCut, 3.0, 2.4);
  lab('掰断辊', '沿划痕折断', X.snap, 2.0, 0);
  lab('掰边 · 碎玻璃回收', '送回原料车间', X.trim + 1.2, 2.2, 3.2);
  lab('翻转堆垛', '真空吸盘 · A字架', X.pick, 4.6, -3.4);
  lab('碎玻璃回收皮带', '→ 配料车间', 10, 1.5, cz1, 'batch');

  const d = new THREE.Object3D();
  const placePlate = (o, k, t) => {
    o.pivot.visible = true;
    o.pivot.rotation.set(0, 0, 0);
    o.body.position.set(0, TH / 2, PLATE_W / 2);
    o.strips.forEach((s) => {
      s.visible = true;
      s.rotation.set(0, 0, 0);
      s.position.set(0, 0, Math.sign(s.position.z) * (PLATE_W / 2 + STRIP / 2));
    });
    const e = (k - 1) * P + D; // 前端到达掰断辊
    const sep = k * P + D; // 后端到达掰断辊（分离）
    if (t < e) return (o.pivot.visible = false);
    if (t < sep) {
      const len = Math.max(0.001, V_RIBBON * (t - e));
      const cx = X.snap + len / 2;
      o.pivot.position.set(cx, LEHR_Y, HINGE_Z);
      o.core.scale.x = len;
      o.strips.forEach((s) => (s.scale.x = len));
      return;
    }
    o.core.scale.x = PLATE_L;
    o.strips.forEach((s) => (s.scale.x = PLATE_L));
    const a = t - sep;
    const cx = X.snap + PLATE_L / 2 + V2 * Math.min(a, A_ARR);
    o.pivot.position.set(cx, LEHR_Y, HINGE_Z);
    // 掰边：两侧毛边折断落入料斗
    if (a > A_TRIM) {
      const f = a - A_TRIM;
      o.strips.forEach((s) => {
        const zs = Math.sign(s.position.z);
        if (f > 1.0) return (s.visible = false);
        s.position.x = -V2 * f * 0.6;
        s.position.y = -4.9 * f * f;
        s.position.z = zs * (PLATE_W / 2 + STRIP / 2 + f * 0.9);
        s.rotation.x = zs * f * 2.2;
      });
    }
    if (a < A_ARR) return;
    // 堆垛
    const s = a - A_ARR;
    if (s < 0.9) {
      o.pivot.rotation.x = (-95 * Math.PI) / 180 * easeInOut(s / 0.9);
      return;
    }
    o.pivot.rotation.x = (-95 * Math.PI) / 180;
    const n = mod(k, RACK_N);
    const target = new THREE.Vector3(X.pick, 0.58, Z_RACK + n * 0.045);
    const u = easeInOut((s - 0.9) / 0.6);
    o.pivot.position.set(X.pick, lerp(LEHR_Y, target.y, u) + Math.sin(u * Math.PI) * 0.4, lerp(HINGE_Z, target.z, u));
  };

  return {
    group: g,
    update(t, dt) {
      // 板：从当前正在"长出"的板往前回溯
      const kNow = Math.floor((t - D) / P) + 1;
      const kPlaced = Math.floor((t - D - A_ARR - 1.5) / P);
      const rack = Math.floor(kPlaced / RACK_N);
      pool.forEach((o) => (o.pivot.visible = false));
      for (let k = kNow; k > kNow - POOL; k--) {
        const o = pool[mod(k, POOL)];
        const placed = k <= kPlaced;
        if (placed && Math.floor(k / RACK_N) !== rack) continue;
        placePlate(o, k, t);
      }
      // 翻转台
      const ks = Math.floor((t - D - A_ARR) / P);
      const ts = t - (ks * P + D + A_ARR);
      const ang = ts < 0.9 ? easeInOut(ts / 0.9) : ts < 1.0 ? 1 : 1 - easeInOut((ts - 1.0) / 0.8);
      tilt.rotation.x = (-95 * Math.PI) / 180 * clamp(ang, 0, 1) * 0.97;

      // 横切：划线 + 切割头
      const c = mod(t, P);
      if (c < SCORE_T) {
        head.position.set(X.cut + V_RIBBON * c, topY + 0.125, -1.95 + (3.9 * c) / SCORE_T);
      } else {
        const z = 1.95 - (3.9 * (c - SCORE_T)) / (P - SCORE_T);
        head.position.set(bridgeX(z), topY + 0.36, z);
      }
      const j0 = Math.floor(t / P);
      lines.forEach((m, i) => {
        const j = j0 - i;
        const age = t - j * P;
        if (age < 0 || age > D) return (m.visible = false);
        m.visible = true;
        const len = Math.min(1, age / SCORE_T) * 3.9;
        m.scale.set(0.014, 0.003, Math.max(0.001, len));
        m.position.set(X.cut + V_RIBBON * age, topY + 0.002, -1.95 + len / 2);
      });
      // 掰断辊：划痕经过时顶起
      const jn = Math.round((t - D) / P);
      const dx = X.cut + V_RIBBON * (t - jn * P) - X.snap;
      snapRoll.position.y = LEHR_Y - 0.09 + Math.exp(-Math.pow(dx / 0.25, 2)) * 0.06;

      // 碎玻璃：横向皮带(-Z) → 回收总皮带(-X)
      for (let i = 0; i < nCul; i++) {
        const s = mod(t * 1.5 + (i / nCul) * pathLen, pathLen);
        if (s < cz0 - cz1) d.position.set(recX0 + ((i % 3) - 1) * 0.2, 0.42, cz0 - s);
        else d.position.set(recX0 - (s - (cz0 - cz1)), 0.72, cz1 + ((i % 3) - 1) * 0.22);
        d.rotation.set(i, i * 0.7, 0);
        d.updateMatrix();
        cul.setMatrixAt(i, d.matrix);
      }
      cul.instanceMatrix.needsUpdate = true;
    },
  };
}

