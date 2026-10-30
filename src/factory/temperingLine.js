import * as THREE from 'three';
import { Batch, makeLabel, Rollers, mod, smooth, clamp } from '../core/util.js';
import { heatColor } from '../core/materials.js';
import { Spray, createStressMaterial } from '../core/effects.js';
import { Z_TEMPER as Z } from '../core/layout.js';

const TY = 0.95; // 辊面高度
const PL = 2.0, PW = 1.4, TH = 0.03;
const PERIOD = 18;
const LIFE = 48;

// 单片玻璃的工艺时间表：[时刻, x]
const PATH = [
  [0, -21.5], [1.5, -21.5], [9.5, -4.5], [13.5, 4.0], [15.0, 15.0],
  // 15–31 s 在炉内往复摆动（见 plateX）
  [31.0, 15.0], [32.0, 29.0],
  // 32–37 s 风栅内小幅摆动
  [37.0, 29.0], [41.0, 36.5], [46.0, 45.0], [48.0, 45.0],
];

function plateX(a) {
  if (a > 15 && a < 31) return 15 + Math.sin(((a - 15) / 4) * Math.PI * 2) * 2.6 * smooth((a - 15) / 1) * smooth((31 - a) / 1);
  if (a > 32 && a < 37) return 29 + Math.sin(((a - 32) / 1.25) * Math.PI * 2) * 0.7;
  for (let i = 1; i < PATH.length; i++) {
    const [t1, x1] = PATH[i];
    const [t0, x0] = PATH[i - 1];
    if (a <= t1) return x0 + (x1 - x0) * smooth((a - t0) / (t1 - t0));
  }
  return PATH[PATH.length - 1][1];
}
function plateT(a) {
  if (a < 15) return 20;
  const exitT = 20 + 660 * (1 - Math.exp(-16 / 5));
  if (a < 31) return 20 + 660 * (1 - Math.exp(-(a - 15) / 5));
  if (a < 32) return exitT;
  return 25 + (exitT - 25) * Math.exp(-(a - 32) / 1.5);
}

/** 深加工线：上片 → 磨边 → 清洗 → 水平钢化炉 → 风栅淬冷 → 冷却 → 下片 */
export function buildTemperingLine(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  g.name = 'tempering';
  const C = (m) => mats.clip(m, 'temper');
  const b = new Batch();

  // 机架通长底座
  b.box(72, 0.2, 2.4, mats.steelDark, 12, 0.1, Z);
  for (let x = -24; x <= 48; x += 2) for (const zs of [-1, 1]) b.box(0.12, TY - 0.2, 0.12, mats.steelFrame, x, (TY - 0.2) / 2 + 0.1, Z + zs * 1.05);
  for (const zs of [-1, 1]) b.box(72, 0.16, 0.12, mats.paintBlue, 12, TY - 0.2, Z + zs * 1.05);

  // ---- 上片台 + 原片架 ----
  b.box(5, 0.1, 2.2, mats.paintGray, -21.5, TY - 0.08, Z);
  b.box(2.8, 0.15, 1.6, mats.steelDark, -21.5, 0.2, Z - 3.4);
  for (let i = 0; i < 12; i++) b.add(new THREE.BoxGeometry(2.6, 1.8, 0.025), mats.glassEdge, -21.5, 1.1, Z - 3.0 - i * 0.04, -0.09, 0, 0);
  b.beam(new THREE.Vector3(-22.7, 0.25, Z - 3.6), new THREE.Vector3(-22.7, 2.2, Z - 3.4), 0.1, 0.1, mats.paintBlue);
  b.beam(new THREE.Vector3(-20.3, 0.25, Z - 3.6), new THREE.Vector3(-20.3, 2.2, Z - 3.4), 0.1, 0.1, mats.paintBlue);
  // 悬臂吸盘吊
  b.box(0.35, 4.2, 0.35, mats.paintYellow, -24.6, 2.1, Z - 1.8);
  b.box(4.2, 0.3, 0.3, mats.paintYellow, -22.7, 4.1, Z - 1.8);
  b.rod(new THREE.Vector3(-21.5, 4.0, Z - 1.8), new THREE.Vector3(-21.5, 2.6, Z - 1.8), 0.03, mats.steelDark, 6);
  b.box(1.4, 0.08, 0.9, mats.paintOrange, -21.5, 2.55, Z - 1.8);

  // ---- 双边磨边机 ----
  const ex0 = -16.5, ex1 = -7.5, exm = (ex0 + ex1) / 2, el = ex1 - ex0;
  for (const zs of [-1, 1]) {
    const zc = Z + zs * 1.35;
    b.box(el, TY - 0.25, 1.1, C(mats.paintGray), exm, (TY - 0.25) / 2 + 0.2, zc);
    b.box(el, 0.12, 1.1, C(mats.paintBlue), exm, TY + 0.55, zc);
    b.box(el, 0.6, 0.06, C(mats.paintGray), exm, TY + 0.25, Z + zs * 1.9);
    for (let x = ex0 + 0.8; x < ex1; x += 1.4) b.box(0.9, 0.36, 0.02, C(mats.darkGlass), x, TY + 0.27, Z + zs * 1.94);
    b.box(el, 0.08, 0.04, C(mats.paintYellow), exm, TY - 0.08, Z + zs * 1.9);
    b.box(el, 0.06, 0.4, C(mats.paintBlue), exm, TY + 0.12, Z + zs * 0.75); // 压紧同步带
    b.box(el, 0.06, 0.4, C(mats.belt), exm, TY - 0.03, Z + zs * 0.75);
    for (let x = ex0 + 0.8; x < ex1; x += 1.4) {
      b.cyl(0.14, 0.5, C(mats.motor), x, TY + 0.35, Z + zs * 1.3, 'y', 14);
      b.cyl(0.04, 0.3, C(mats.chrome), x, TY + 0.12, Z + zs * 0.95, 'y', 8);
    }
  }
  b.box(1.2, 1.8, 0.8, mats.paintWhite, ex1 - 0.8, 0.9, Z - 3.0);
  b.box(0.7, 0.45, 0.02, mats.screen, ex1 - 0.8, 1.35, Z - 2.59);
  const wheels = [];
  for (const zs of [-1, 1]) {
    for (let x = ex0 + 0.8; x < ex1; x += 1.4) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 18), C(mats.galv));
      w.position.set(x, TY + 0.015, Z + zs * (PW / 2 + 0.11));
      g.add(w);
      wheels.push(w);
    }
  }

  // ---- 清洗干燥机 ----
  const wx0 = -5.5, wx1 = 2.5;
  b.box(wx1 - wx0, 1.3, 2.6, C(mats.paintGray), (wx0 + wx1) / 2, TY + 0.85, Z);
  for (let x = wx0 + 1; x < wx1; x += 2) b.box(1.2, 0.5, 0.02, C(mats.darkGlass), x, TY + 0.9, Z - 1.31);
  b.box(wx1 - wx0, 0.5, 2.6, C(mats.paintBlue), (wx0 + wx1) / 2, 0.45, Z);
  b.box(1.4, 1.2, 1.2, mats.paintBlue, -1.5, 0.6, Z - 2.4); // 水箱/泵
  b.cyl(0.35, 1.6, mats.galv, 1.2, 2.3, Z - 0.0, 'z'); // 风刀风机
  const brushes = [];
  for (const x of [-4.6, -3.7, -2.8, -1.9]) {
    for (const y of [TY + 0.14, TY - 0.14]) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.0, 14).rotateX(Math.PI / 2), C(mats.paintBlue));
      br.position.set(x, y, Z);
      g.add(br);
      brushes.push(br);
    }
  }
  for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.05, 0.25, 2.0), C(mats.chrome), 0.8, TY + s * 0.18, Z, 0, 0, s * 0.4);

  // ---- 钢化加热炉 ----
  const fx0 = 6, fx1 = 24, fm = (fx0 + fx1) / 2, fl = fx1 - fx0;
  const shell = C(mats.paintWhite);
  b.box(fl, 0.25, 3.4, shell, fm, TY + 1.55, Z);
  b.box(fl, 0.5, 3.4, C(mats.insulation), fm, TY + 1.2, Z);
  b.box(fl, 0.4, 3.4, shell, fm, 0.45, Z);
  for (const zs of [-1, 1]) b.box(fl, 1.5, 0.25, shell, fm, TY + 0.15, Z + zs * 1.6);
  for (let x = fx0 + 1.5; x < fx1; x += 3) {
    b.cyl(0.32, 0.5, C(mats.motor), x, TY + 1.95, Z - 0.5);
    b.box(0.6, 0.3, 0.6, C(mats.paintGray), x, TY + 1.8, Z + 0.6);
  }
  for (let x = fx0 + 0.3; x < fx1 - 0.2; x += 0.45) {
    b.cyl(0.025, 2.8, C(mats.heater), x, TY + 0.65, Z, 'z', 6); // 上加热丝
    b.cyl(0.025, 2.8, C(mats.heater), x, TY - 0.3, Z, 'z', 6); // 下加热丝
  }
  for (let x = fx0 + 1; x < fx1; x += 3.4) {
    b.box(1.4, 2.2, 0.6, mats.paintWhite, x, 1.1, Z - 3.2);
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), mats.lampGreen, x - 0.4, 1.9, Z - 2.89, Math.PI / 2, 0, 0);
  }
  b.box(1.0, 0.6, 0.05, mats.screen, fm, 1.6, Z - 2.88);
  // 炉门
  const doors = [fx0, fx1].map((x) => {
    const dm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 3.2), C(mats.paintGray));
    dm.position.set(x, TY + 0.55, Z);
    g.add(dm);
    return dm;
  });

  // ---- 风栅（淬冷段）+ 冷却段 ----
  const qx0 = 25.4, qx1 = 32.6, qm = (qx0 + qx1) / 2, ql = qx1 - qx0;
  b.box(ql, 0.55, 2.6, C(mats.paintBlue), qm, TY + 1.0, Z); // 上风箱
  b.box(ql, 0.45, 2.6, C(mats.paintBlue), qm, TY - 0.6, Z); // 下风箱
  for (let x = qx0 + 0.3; x < qx1; x += 0.35) {
    for (let z = -1.0; z <= 1.01; z += 0.25) {
      b.cyl(0.025, 0.42, C(mats.galv), x, TY + 0.52, Z + z, 'y', 6);
      b.cyl(0.025, 0.25, C(mats.galv), x, TY - 0.27, Z + z, 'y', 6);
    }
  }
  for (const zs of [-1, 1]) for (const x of [qx0, qx1]) b.box(0.25, 2.3, 0.25, C(mats.steelFrame), x, 1.15, Z + zs * 1.45);
  // 风机与风道（-Z 侧）
  b.cyl(1.4, 1.2, mats.paintBlue, qm, 2.2, Z - 5.2, 'z', 32);
  b.cyl(0.6, 1.4, mats.motor, qm, 2.2, Z - 6.4, 'z', 20);
  b.box(1.6, 1.6, 1.0, mats.paintBlue, qm + 1.2, 1.4, Z - 4.2);
  b.box(1.4, 0.8, 2.6, mats.galv, qm, 2.6, Z - 3.0);
  b.box(1.4, 0.6, 2.4, mats.galv, qm, TY + 1.0, Z - 2.4);
  b.box(1.4, 0.5, 3.6, mats.galv, qm, 0.35, Z - 2.9);
  b.box(2.6, 1.0, 2.0, mats.steelDark, qm, 0.5, Z - 5.2);
  // 冷却段
  const cx0 = 33.2, cx1 = 40.4;
  b.box(cx1 - cx0, 0.4, 2.4, C(mats.galv), (cx0 + cx1) / 2, TY + 0.85, Z);
  for (let x = cx0 + 0.4; x < cx1; x += 0.6) b.cyl(0.02, 0.6, C(mats.galv), x, TY + 0.45, Z, 'y', 6);
  b.cyl(0.6, 0.8, mats.paintBlue, (cx0 + cx1) / 2, 2.4, Z - 0.0, 'y', 20);
  // 下片台 + 成品架
  b.box(6, 0.1, 2.2, mats.paintGray, 45, TY - 0.08, Z);
  b.box(2.8, 0.15, 1.6, mats.steelDark, 45, 0.2, Z - 3.4);
  b.beam(new THREE.Vector3(43.8, 0.25, Z - 3.6), new THREE.Vector3(43.8, 2.2, Z - 3.4), 0.1, 0.1, mats.paintBlue);
  b.beam(new THREE.Vector3(46.2, 0.25, Z - 3.6), new THREE.Vector3(46.2, 2.2, Z - 3.4), 0.1, 0.1, mats.paintBlue);
  b.flush(g);

  // 成品钢化玻璃（应力模式下显示风斑）
  const stack = [];
  const stackStress = createStressMaterial();
  stackStress.uniforms.uSize.value.set(PL, PW);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(PL, PW, TH), mats.glass);
    m.position.set(45, 0.3 + PW / 2 + 0.02, Z - 3.0 - i * 0.045);
    m.rotation.x = 0.09;
    g.add(m);
    stack.push(m);
  }

  // ---- 辊道 ----
  const steelPos = [], cerPos = [];
  for (let x = -23.8; x <= 47.5; x += 0.55) {
    if (x > ex0 && x < ex1) continue;
    if (x > wx0 && x < wx1 && Math.abs(mod(x, 0.9)) < 0.3) continue;
    (x > fx0 && x < fx1 ? cerPos : steelPos).push({ x, y: TY - 0.06, z: Z });
  }
  const rollers = new Rollers({ positions: steelPos, length: 2.0, radius: 0.06, material: mats.rollerSteel });
  const rollersC = new Rollers({ positions: cerPos, length: 3.0, radius: 0.06, material: C(mats.rollerCeramic) });
  g.add(rollers.mesh, rollersC.mesh);

  // ---- 玻璃板 ----
  const plates = [];
  for (let i = 0; i < Math.ceil(LIFE / PERIOD) + 1; i++) {
    const mat = mats.glass.clone();
    mat.emissive = new THREE.Color();
    const stress = createStressMaterial();
    stress.uniforms.uSize.value.set(PL, PW);
    const m = new THREE.Mesh(new THREE.BoxGeometry(PL, TH, PW), mat);
    m.castShadow = true;
    g.add(m);
    plates.push({ m, mat, stress });
  }

  // 粒子：风栅冷却气流、磨边冷却水、清洗水雾
  const air = new Spray({ count: 520, color: [0.55, 0.75, 1.6], size: 0.07, opacity: 0.75 });
  const water = new Spray({ count: 260, color: [0.5, 0.7, 1.0], size: 0.05, opacity: 0.7 });
  g.add(air.points, water.points);

  // ---- 标签 ----
  const lab = (t, s, x, y, z, st, temp) => {
    const l = makeLabel(t, { sub: s, temp });
    l.position.set(x, y, z);
    ctx.addLabel(l, st);
  };
  lab('上片台', '原片切裁后上线', -21.5, 3.4, Z, 'edging');
  lab('双边磨边机', '粗磨 · 精磨 · 抛光 · 倒角', exm, 2.4, Z, 'edging');
  lab('清洗干燥机', '毛刷 + 纯水 + 风刀', -1.5, 3.0, Z, 'edging');
  lab('钢化加热炉', '陶瓷辊往复摆动', fm, 3.6, Z, 'temper', '≈ 650–700°C');
  lab('风栅 · 急冷', '高压空气对吹', qm, 3.2, Z, 'temper', '数秒内降至 300°C 以下');
  lab('冷却段', '继续冷却至室温', (cx0 + cx1) / 2, 3.5, Z, 'temper');
  lab('下片台', '钢化玻璃成品', 45, 3.2, Z, 'temper');

  const col = new THREE.Color();
  return {
    group: g,
    update(t, dt, sim) {
      let quenchOn = 0, edgeOn = 0, washOn = 0;
      let entryOpen = 0, exitOpen = 0;
      const plateSpans = [];
      plates.forEach((p, i) => {
        const k = Math.floor(t / PERIOD) - i;
        const a = t - k * PERIOD;
        if (a < 0 || a > LIFE) return (p.m.visible = false);
        p.m.visible = true;
        const x = plateX(a);
        const v = (plateX(a + 0.05) - x) / 0.05;
        plateSpans.push([x - PL / 2, x + PL / 2, v]);
        const y = TY + TH / 2 + (a < 1.5 ? (1 - smooth(a / 1.5)) * 1.2 : 0);
        p.m.position.set(x, y, Z);
        // 温度辉光
        const T = plateT(a);
        heatColor(T, col);
        p.mat.emissive.copy(col).multiplyScalar(1.0);
        p.mat.opacity = a > 46 ? 1 - smooth((a - 46) / 2) : 1;
        // 应力光弹视图
        const strength = clamp((a - 32) / 3, 0, 1);
        p.stress.uniforms.uStrength.value = strength;
        p.m.material = sim.stress && a > 31.5 ? p.stress : p.mat;
        if (a > 32 && a < 37) quenchOn = Math.max(quenchOn, smooth((a - 32) / 0.3) * (1 - smooth((a - 36.5) / 0.5)));
        if (x > ex0 - 1 && x < ex1 + 1 && a < 10) edgeOn = 1;
        if (x > wx0 - 1 && x < wx1 + 1 && a < 14) washOn = 1;
        entryOpen = Math.max(entryOpen, phase2(a, 12.8, 15.4));
        exitOpen = Math.max(exitOpen, phase2(a, 30.5, 32.2));
      });
      stack.forEach((m) => (m.material = sim.stress ? stackStress : mats.glass));
      doors[0].position.y = TY + 0.55 + entryOpen * 0.55;
      doors[1].position.y = TY + 0.55 + exitOpen * 0.55;

      const speedAt = (x) => {
        for (const [a, b2, v] of plateSpans) if (x > a - 0.3 && x < b2 + 0.3) return v;
        return 0;
      };
      rollers.update(dt, speedAt);
      rollersC.update(dt, speedAt);
      for (const w of wheels) w.rotation.y += dt * (edgeOn ? 30 : 2);
      for (const br of brushes) br.rotation.z += dt * (washOn ? 14 : 1) * (br.position.y > TY ? 1 : -1);

      air.mat.opacity = 0.75 * quenchOn;
      air.points.visible = quenchOn > 0.01;
      if (air.points.visible) {
        air.update((i, s, out) => {
          const u = mod(t * 2.2 + s[0], 1);
          const up = i % 2 === 0;
          out[0] = qx0 + 0.3 + s[1] * (ql - 0.6);
          const spread = u > 0.7 ? (u - 0.7) * 3 : 0;
          out[2] = Z - 1.0 + s[2] * 2.0 + (s[3] - 0.5) * spread;
          out[1] = up ? TY + 0.3 - u * 0.27 : TY - 0.15 + u * 0.13;
        });
      }
      water.points.visible = edgeOn + washOn > 0;
      if (water.points.visible) {
        water.update((i, s, out) => {
          const u = mod(t * 1.6 + s[0], 1);
          if (i % 2 === 0 && edgeOn) {
            const wi = Math.floor(s[1] * wheels.length);
            const w = wheels[wi];
            out[0] = w.position.x + (s[2] - 0.5) * 0.4;
            out[1] = TY + 0.25 - u * 0.4;
            out[2] = w.position.z + (s[3] - 0.5) * 0.3;
          } else {
            out[0] = -4.8 + s[1] * 3.2;
            out[1] = TY + 0.5 - u * 0.45;
            out[2] = Z - 0.9 + s[2] * 1.8;
          }
        });
      }
    },
  };
}

function phase2(a, t0, t1) {
  return smooth((a - t0) / 0.6) * (1 - smooth((a - (t1 - 0.6)) / 0.6));
}

