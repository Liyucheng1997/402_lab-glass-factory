import * as THREE from 'three';
import { Batch, makeLabel, mod, rng, phase } from '../core/util.js';
import { heatTexture, HEAT_MAX, tiled } from '../core/materials.js';
import { createFlameMaterial, makeFlame, Spray } from '../core/effects.js';
import { X } from '../core/layout.js';

const MELT_Y = 1.8; // 玻璃液面
const PORTS = [-61.5, -57, -52.5, -48];
export const REVERSAL = 20; // 换火周期（演示时间）

/** 横火焰蓄热式浮法熔窑：熔化部、卡脖、冷却部、流道 */
export function buildFurnace(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  g.name = 'furnace';
  const C = (m) => mats.clip(m, 'main');
  const refr = C(tiled(mats.refractory, 6, 1.2));
  const refrSide = C(tiled(mats.refractory, 8, 1));
  const azs = C(tiled(mats.azs, 10, 1));
  const steel = C(mats.steelDark);
  const frame = C(mats.steelFrame);
  const regenMat = C(tiled(mats.refractoryDark, 6, 3));
  const b = new Batch();

  const x0 = X.furnaceBack, x1 = X.melterEnd;
  const L = x1 - x0, cx = (x0 + x1) / 2;
  const W = 10; // 外宽
  // ---- 熔化部池壁与池底 ----
  b.box(L + 0.6, 0.8, W, refr, cx, 0.4, 0); // 池底
  b.box(L, 1.5, 0.6, azs, cx, 1.55, -W / 2 + 0.3);
  b.box(L, 1.5, 0.6, azs, cx, 1.55, W / 2 - 0.3);
  b.box(0.6, 1.5, W, azs, x0 + 0.3, 1.55, 0);
  // 胸墙（开小炉口）
  const breastY0 = 2.3, breastY1 = 3.5;
  for (const zs of [-1, 1]) {
    const z = zs * (W / 2 - 0.3);
    let last = x0;
    for (const px of PORTS) {
      b.box(px - 0.8 - last, breastY1 - breastY0, 0.5, refrSide, (last + px - 0.8) / 2, (breastY0 + breastY1) / 2, z);
      b.box(1.6, 0.3, 0.5, refrSide, px, breastY1 - 0.15, z);
      last = px + 0.8;
    }
    b.box(x1 - last, breastY1 - breastY0, 0.5, refrSide, (last + x1) / 2, (breastY0 + breastY1) / 2, z);
    b.box(L, 0.5, 0.6, azs, cx, 2.05, z); // 池壁顶部
  }
  b.box(0.6, breastY1 - 2.3 + 0.5, W, refr, x0 + 0.3, (2.3 + breastY1) / 2 - 0.25, 0);
  // 大碹（拱顶）
  const span = W - 0.4, rise = 1.3;
  const R = (span * span) / 4 / (2 * rise) + rise / 2;
  const alpha = Math.asin(span / 2 / R);
  const crownGeo = new THREE.CylinderGeometry(R, R, L, 48, 1, true, Math.PI / 2 - alpha, alpha * 2);
  crownGeo.rotateZ(Math.PI / 2);
  b.add(crownGeo, C(tiled(mats.refractory, 1.5, 6)), cx, breastY1 + rise - R, 0);
  const crownGeo2 = new THREE.CylinderGeometry(R + 0.35, R + 0.35, L, 48, 1, true, Math.PI / 2 - alpha * 1.04, alpha * 2.08);
  crownGeo2.rotateZ(Math.PI / 2);
  b.add(crownGeo2, C(mats.insulation), cx, breastY1 + rise - R, 0);
  // 碹脚梁
  for (const zs of [-1, 1]) b.box(L, 0.4, 0.5, steel, cx, breastY1 + 0.1, zs * (span / 2 + 0.1));
  // 立柱（钢结构护炉）与拉条
  for (let x = x0 + 0.6; x <= x1 - 0.4; x += 1.8) {
    if (PORTS.some((p) => Math.abs(p - x) < 1.0)) continue;
    for (const zs of [-1, 1]) b.hColumn(x, 0, breastY1 + 0.8, zs * (W / 2 + 0.25), 0.35, frame, Math.PI / 2);
    b.rod(new THREE.Vector3(x, breastY1 + rise + 0.8, -W / 2 - 0.25), new THREE.Vector3(x, breastY1 + rise + 0.8, W / 2 + 0.25), 0.05, steel, 6);
    for (const zs of [-1, 1]) b.rod(new THREE.Vector3(x, breastY1 + 0.7, zs * (W / 2 + 0.25)), new THREE.Vector3(x, breastY1 + rise + 0.8, zs * (W / 2 + 0.05)), 0.05, steel, 6);
  }
  // 投料口（L 型吊墙前的延伸池）
  b.box(0.8, 1.0, 4.6, azs, x0 - 0.2, 1.8, -2.6);
  b.box(0.8, 1.0, 0.4, azs, x0 - 0.2, 1.8, 2.5);

  // ---- 小炉 + 蓄热室 ----
  const regX0 = -63.5, regX1 = -46.5;
  for (const zs of [-1, 1]) {
    const zc = zs * 8.6;
    b.box(regX1 - regX0, 7.8, 4.2, regenMat, (regX0 + regX1) / 2, 3.9, zc);
    b.add(new THREE.CylinderGeometry(2.25, 2.25, regX1 - regX0, 24, 1, false, -Math.PI / 2, Math.PI), C(tiled(mats.refractoryDark, 4, 1)), (regX0 + regX1) / 2, 7.8, zc, 0, 0, Math.PI / 2);
    for (let x = regX0; x <= regX1 + 0.01; x += 1.7) {
      b.hColumn(x, 0, 8.6, zc + zs * 2.25, 0.3, frame, Math.PI / 2);
      b.hColumn(x, 0, 8.6, zc - zs * 2.25, 0.3, frame, Math.PI / 2);
    }
    for (const px of PORTS) {
      // 小炉颈
      b.box(1.9, 1.5, 2.2, refrSide, px, 2.95, zs * 5.9);
      b.box(2.3, 0.4, 2.4, refr, px, 3.9, zs * 5.9);
      // 燃气喷枪（小炉底部）
      for (const dx of [-0.5, 0, 0.5]) {
        b.rod(new THREE.Vector3(px + dx, 1.6, zs * 6.9), new THREE.Vector3(px + dx, 2.25, zs * 5.3), 0.05, C(mats.galv), 6);
      }
    }
    // 燃气总管
    b.cyl(0.14, regX1 - regX0 + 2, C(mats.paintYellow), (regX0 + regX1) / 2, 1.6, zs * 6.9, 'x');
    // 助燃空气 / 烟气通道（入地）
    b.box(2.0, 1.8, 2.4, regenMat, regX0 - 1.2, 0.9, zc);
  }
  // 蓄热室格子砖：剖切时可见（-Z 侧）
  const checkerMat = C(new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.9, emissive: 0x000000 }));
  const checker = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.18, 3.6), checkerMat, 18 * 14);
  {
    const d = new THREE.Object3D();
    let i = 0;
    for (let row = 0; row < 18; row++)
      for (let col = 0; col < 14; col++) {
        d.position.set(regX0 + 0.8 + col * 1.15 + (row % 2) * 0.5, 1.2 + row * 0.33, -8.6);
        d.updateMatrix();
        checker.setMatrixAt(i++, d.matrix);
      }
  }
  g.add(checker);

  // ---- 卡脖 + 冷却部 + 流道 ----
  const wx0 = X.melterEnd, wx1 = X.waistEnd;
  b.box(wx1 - wx0, 0.8, 5.6, refr, (wx0 + wx1) / 2, 0.4, 0);
  for (const zs of [-1, 1]) {
    b.box(wx1 - wx0, 2.2, 0.5, azs, (wx0 + wx1) / 2, 1.9, zs * 2.55);
  }
  b.box(wx1 - wx0, 0.4, 5.6, refr, (wx0 + wx1) / 2, 3.2, 0);
  // 卡脖搅拌器
  for (const z of [-1.4, 0, 1.4]) {
    b.cyl(0.07, 2.4, C(mats.chrome), -40, 2.4, z);
    b.cyl(0.18, 0.5, C(mats.motor), -40, 3.9, z);
  }
  b.cyl(0.1, 6.2, C(mats.galv), -41.2, 1.9, 0, 'z'); // 水包
  const ex0 = X.waistEnd, ex1 = X.workEnd;
  b.box(ex1 - ex0, 0.8, 8.4, refr, (ex0 + ex1) / 2, 0.4, 0);
  for (const zs of [-1, 1]) b.box(ex1 - ex0, 2.3, 0.5, azs, (ex0 + ex1) / 2, 1.95, zs * 3.95);
  b.box(0.5, 2.3, 8.4, azs, ex1 - 0.25, 1.95, 0);
  const cr2 = new THREE.CylinderGeometry(9, 9, ex1 - ex0, 36, 1, true, Math.PI / 2 - 0.45, 0.9);
  cr2.rotateZ(Math.PI / 2);
  b.add(cr2, C(tiled(mats.refractory, 1, 3)), (ex0 + ex1) / 2, 3.1 - 9 * Math.cos(0.45) + 0.2, 0);
  for (let x = ex0 + 0.5; x < ex1; x += 1.6) for (const zs of [-1, 1]) b.hColumn(x, 0, 3.6, zs * 4.4, 0.3, frame, Math.PI / 2);
  // 流道 + 闸板
  b.box(1.6, 1.2, 3.0, refr, -31.3, 0.9, 0);
  for (const zs of [-1, 1]) b.box(1.6, 0.9, 0.4, azs, -31.3, 1.95, zs * 1.3);
  b.box(0.25, 1.3, 2.4, C(mats.refractoryDark), -31.8, 2.55, 0); // 安全闸板
  b.box(0.2, 1.2, 2.4, C(mats.azs), -31.0, 2.45, 0); // 节流闸板（tweel）
  for (const zs of [-1, 1]) b.box(0.25, 3.4, 0.25, frame, -31.4, 1.7 + 1.7, zs * 1.8);
  b.box(0.3, 0.3, 3.9, frame, -31.4, 5.1, 0);
  b.cyl(0.05, 2.2, C(mats.chrome), -31.0, 4.0, 0.5);
  b.cyl(0.05, 2.2, C(mats.chrome), -31.0, 4.0, -0.5);
  b.box(0.5, 0.4, 1.4, C(mats.motor), -31.0, 5.45, 0);
  b.flush(g);

  // ---- 玻璃液（剖切后可见截面） ----
  const meltProfile = [
    [-66, 1380], [-58, 1520], [-50, 1580], [-44, 1500], [-40, 1340], [-35, 1180], [-31, 1100],
  ];
  const meltTex = heatTexture(meltProfile, -66, -30.5);
  const meltMat = C(
    new THREE.MeshStandardMaterial({ color: 0x281000, emissive: 0xffffff, emissiveMap: meltTex, emissiveIntensity: HEAT_MAX, roughness: 0.25 })
  );
  const melt = new THREE.Group();
  const addMelt = (xa, xb, w, y0) => {
    const geo = new THREE.BoxGeometry(xb - xa, MELT_Y - y0, w);
    // uv.x 统一映射到全段 x，以便沿程温度连续
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + (xa + xb) / 2 + 66) / 35.5, 0.5);
    const m = new THREE.Mesh(geo, meltMat);
    m.position.set((xa + xb) / 2, (MELT_Y + y0) / 2, 0);
    melt.add(m);
  };
  addMelt(x0 + 0.6, x1, W - 1.2, 0.8);
  addMelt(wx0, wx1, 4.6, 0.8);
  addMelt(ex0, ex1 - 0.5, 7.4, 0.8);
  addMelt(-32.2, -30.5, 2.2, 1.4);
  addMelt(x0 - 0.6, x0 + 0.6, 4.0, 1.3);
  g.add(melt);

  // 液面流动纹理（叠加）
  const flowTex = mats.tex.noise.clone();
  flowTex.repeat.set(8, 2);
  flowTex.needsUpdate = true;
  const flow = new THREE.Mesh(
    new THREE.PlaneGeometry(x1 - x0 - 0.6, W - 1.2),
    C(new THREE.MeshBasicMaterial({ map: flowTex, color: new THREE.Color(1.6, 0.9, 0.3), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }))
  );
  flow.rotation.x = -Math.PI / 2;
  flow.position.set(cx + 0.3, MELT_Y + 0.01, 0);
  g.add(flow);

  // 配合料料堆（漂浮于液面，向下游移动并逐渐熔化）
  const isl = 34;
  const islGeo = new THREE.CylinderGeometry(1, 1, 0.16, 10);
  {
    const p = islGeo.attributes.position;
    const r = rng(4);
    for (let i = 0; i < p.count; i++) {
      const k = 0.75 + r() * 0.45;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * (0.8 + r() * 0.3));
    }
    islGeo.computeVertexNormals();
  }
  const islands = new THREE.InstancedMesh(islGeo, C(mats.batch), isl);
  islands.castShadow = true;
  g.add(islands);
  const islSeed = Array.from({ length: isl }, (_, i) => ({ z: ((i * 7) % 9) - 4 + (i % 2) * 0.5, ph: i / isl, s: 0.7 + ((i * 13) % 7) / 10 }));

  // 对流粒子（剖切可见）：热点处上升，表层分别流向投料端和成形端
  const conv = new Spray({ count: 420, color: [2.6, 1.6, 0.6], size: 0.16, opacity: 0.9 });
  conv.points.material = conv.mat = C(conv.points.material);
  g.add(conv.points);
  // 澄清气泡
  const bub = new Spray({ count: 90, color: [1.4, 1.4, 1.3], size: 0.13, opacity: 0.9, additive: false });
  bub.points.material = bub.mat = C(bub.points.material);
  bub.mat.size = 0.1;
  g.add(bub.points);

  // ---- 火焰（左右两侧小炉交替燃烧：蓄热式换火） ----
  const flames = [];
  for (const zs of [-1, 1]) {
    for (const px of PORTS) {
      const mat = createFlameMaterial();
      const f = makeFlame(7.6, 0.75, mat);
      f.position.set(px, 2.55, zs * 4.7);
      f.rotation.x = zs * -Math.PI / 2; // 指向对侧
      f.scale.set(1, 1, 0.45);
      f.userData = { side: zs, mat };
      g.add(f);
      flames.push(f);
    }
  }
  const glow = new THREE.PointLight(0xff7a2a, 10, 16, 2);
  glow.position.set(-54, 3.0, 0);
  g.add(glow);

  // ---- 标签 ----
  const lab = (t, s, x, y, z, st = 'furnace', temp = null) => {
    const l = makeLabel(t, { sub: s, temp });
    l.position.set(x, y, z);
    ctx.addLabel(l, st);
  };
  lab('熔化部', '配合料熔化 · 澄清', -56, 6.6, 0, 'furnace', '1550–1600°C');
  lab('蓄热室', '格子砖储热/放热', -55, 10.4, -8.6);
  lab('小炉喷枪', '天然气 + 预热空气', -48, 1.0, -7.6);
  lab('卡脖 · 搅拌器', '均化玻璃液', -40, 5.0, 0);
  lab('冷却部', '降温至成形温度', -35, 4.8, 0, 'furnace', '~1100°C');
  lab('流道 · 闸板', '控制流量', -31.3, 6.2, 0, 'float');

  const d = new THREE.Object3D();
  const cHot = new THREE.Color(0.22, 0.08, 0.03);
  return {
    group: g,
    update(t, dt, sim) {
      flowTex.offset.x -= dt * 0.03;
      // 换火：每 REVERSAL 秒切换一侧，切换时约 1.5 秒双侧熄火（换向）
      const cycle = mod(t, REVERSAL * 2);
      const side = cycle < REVERSAL ? -1 : 1;
      const local = mod(t, REVERSAL);
      const p = phase(local, 0.6, 2.0) * (1 - phase(local, REVERSAL - 1.0, REVERSAL));
      for (const f of flames) {
        f.userData.mat.uniforms.uTime.value = t;
        f.userData.mat.uniforms.uPower.value = f.userData.side === side ? p : 0;
        f.visible = f.userData.side === side && p > 0.01;
      }
      glow.intensity = 6 + 10 * p;
      // 格子砖：燃烧侧被废气加热（-Z 侧 side=1 时为排烟侧）
      const heatNeg = side === 1 ? phase(local, 0, REVERSAL) : 1 - phase(local, 0, REVERSAL);
      checkerMat.emissive.copy(cHot).multiplyScalar(0.3 + heatNeg * 2.2);

      // 料堆
      for (let i = 0; i < isl; i++) {
        const s = islSeed[i];
        const u = mod(t * 0.025 + s.ph, 1);
        d.position.set(-65.4 + u * 12.5, MELT_Y + 0.02, s.z * (1 - u * 0.3));
        const sc = Math.max(0.0001, (1 - u) * s.s * 1.1);
        d.scale.set(sc, 1 - u * 0.6, sc);
        d.rotation.set(0, i, 0);
        d.updateMatrix();
        islands.setMatrixAt(i, d.matrix);
      }
      islands.instanceMatrix.needsUpdate = true;

      if (!sim.cutaway) return;
      // 两个对流环：投料端回流环（逆时针）与成形端环（顺时针）
      conv.update((i, sd, out) => {
        const loopA = i % 3 !== 0;
        const k = 0.45 + sd[1] * 0.55;
        const sp = loopA ? 0.12 : -0.2;
        const ang = sd[0] * Math.PI * 2 + t * sp / k;
        const cxl = loopA ? -57.5 : -46.2, rx = loopA ? 7.3 : 3.6;
        out[0] = cxl + Math.cos(ang) * rx * k;
        out[1] = 1.3 + Math.sin(ang) * 0.42 * k;
        out[2] = -0.1 - sd[2] * 0.6;
      });
      bub.update((i, sd, out) => {
        const u = mod(t * (0.06 + sd[3] * 0.05) + sd[0], 1);
        out[0] = -56 + sd[1] * 12 + Math.sin(u * 9 + i) * 0.1;
        out[1] = 0.85 + u * (MELT_Y - 0.88);
        out[2] = -0.12 - sd[2] * 0.5;
      });
    },
    meltY: MELT_Y,
  };
}

export function reversalSide(t) {
  return mod(t, REVERSAL * 2) < REVERSAL ? -1 : 1;
}
