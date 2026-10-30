import * as THREE from 'three';
import { Batch, makeLabel, mod, smooth, easeInOut, lerp, clamp, piecewise } from '../core/util.js';
import { heatColor, heatTexture, HEAT_MAX, tiled } from '../core/materials.js';
import { createFlameMaterial, makeFlame } from '../core/effects.js';
import { Z_BOTTLE as Z } from '../core/layout.js';

const CYCLE = 6; // 单组成型周期
const SECTIONS = 4;
const GAP = CYCLE / SECTIONS; // 剪料间隔
const FX = -35; // 料道末端供料机
const SX = (i) => -38.75 + 2.5 * i; // 各机组 x
const ZB = Z + 1.0; // 初型侧
const ZW = Z - 1.0; // 成型侧
const YN = 2.0; // 口模（瓶口）高度 / 翻转轴高度
const CONV_Z = Z - 3.3;
const CONV_Y = 1.3;
const V_CONV = 0.8;
const ML = 5.3; // 料道玻璃液面

// 轮廓（r, y）：瓶底 y=0，瓶口 y=0.55
const BOTTLE = [[0, 0], [0.085, 0], [0.105, 0.015], [0.11, 0.05], [0.11, 0.3], [0.104, 0.345], [0.075, 0.4], [0.048, 0.445], [0.04, 0.475], [0.04, 0.505], [0.049, 0.51], [0.049, 0.54], [0.042, 0.55], [0.0005, 0.55]];
const PARISON = [[0, 0.14], [0.05, 0.14], [0.068, 0.16], [0.075, 0.2], [0.078, 0.32], [0.075, 0.4], [0.06, 0.44], [0.046, 0.46], [0.04, 0.475], [0.04, 0.505], [0.049, 0.51], [0.049, 0.54], [0.042, 0.55], [0.0005, 0.55]];
const GOB = [[0, 0.19], [0.04, 0.195], [0.062, 0.215], [0.07, 0.26], [0.072, 0.32], [0.072, 0.4], [0.07, 0.46], [0.066, 0.5], [0.058, 0.525], [0.048, 0.54], [0.036, 0.548], [0.024, 0.552], [0.012, 0.554], [0.0005, 0.555]];

/** 瓶坯几何：以瓶口为原点、瓶身沿 +Y（初型模中"口朝下"的姿态），带两个形变目标：初型、成品瓶 */
function wareGeometry() {
  const make = (prof) => {
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28);
    g.rotateX(Math.PI);
    g.translate(0, 0.55, 0);
    g.computeVertexNormals();
    return g;
  };
  const base = make(GOB);
  const par = make(PARISON);
  const bot = make(BOTTLE);
  base.morphAttributes.position = [par.attributes.position, bot.attributes.position];
  base.morphAttributes.normal = [par.attributes.normal, bot.attributes.normal];
  return base;
}
function bottleGeometry() {
  const g = new THREE.LatheGeometry(BOTTLE.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  g.computeVertexNormals();
  return g;
}
/** 半个模具（沿 x 分模） */
function halfMold(r, h, side) {
  const g = new THREE.CylinderGeometry(r, r, h, 20, 1, false, side > 0 ? 0 : Math.PI, Math.PI);
  return g;
}

/** 日用玻璃瓶罐线：小型熔窑 → 料道 → 供料机 → 行列式制瓶机（吹-吹法）→ 退火炉 → 检验 */
export function buildBottleLine(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  g.name = 'bottleLine';
  const C = (m) => mats.clip(m, 'bottle');
  const b = new Batch();
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.45, metalness: 0.75 });
  const machine = new THREE.MeshStandardMaterial({ color: 0x8796a6, roughness: 0.5, metalness: 0.35 });

  // ---------- 小型蓄热式马蹄焰窑 ----------
  const kx0 = -66, kx1 = -55, kxm = (kx0 + kx1) / 2, kl = kx1 - kx0;
  b.box(kl + 1, 3.4, 9, mats.plinth, kxm, 1.7, Z); // 窑底平台
  for (let x = kx0; x <= kx1; x += 2.2) for (const zs of [-1, 1]) b.box(0.5, 3.4, 0.5, mats.plinth, x, 1.7, Z + zs * 4.6);
  b.box(kl, 0.5, 7.4, C(tiled(mats.refractory, 4, 1)), kxm, 3.65, Z);
  for (const zs of [-1, 1]) b.box(kl, 2.6, 0.5, C(tiled(mats.azs, 6, 1)), kxm, 5.2, Z + zs * 3.45);
  b.box(0.5, 2.6, 7.4, C(tiled(mats.azs, 3, 1)), kx0 + 0.25, 5.2, Z);
  b.box(0.5, 1.2, 7.4, C(tiled(mats.azs, 3, 1)), kx1 - 0.25, 5.9, Z);
  {
    const R = 7, a = 0.55;
    const cg = new THREE.CylinderGeometry(R, R, kl, 36, 1, true, Math.PI / 2 - a, 2 * a);
    cg.rotateZ(Math.PI / 2);
    b.add(cg, C(tiled(mats.refractory, 1, 4)), kxm, 6.5 - R * Math.cos(a) + 0.0, Z);
  }
  for (let x = kx0 + 0.4; x < kx1; x += 1.8) for (const zs of [-1, 1]) b.hColumn(x, 3.4, 7.4, Z + zs * 3.9, 0.28, C(mats.steelFrame), Math.PI / 2);
  // 端部蓄热室（马蹄焰：两个小炉并排在后端墙）
  b.box(4.6, 7.6, 7.4, C(tiled(mats.refractoryDark, 3, 3)), kx0 - 2.6, 3.8, Z);
  for (const zs of [-1, 1]) b.box(1.4, 1.2, 2.2, C(mats.refractory), kx0 - 0.4, 5.6, Z + zs * 1.8);
  // 侧面投料机
  b.box(1.6, 1.4, 1.6, mats.paintBlue, -61, 4.4, Z + 4.4);
  b.add(new THREE.CylinderGeometry(1.0, 0.4, 1.4, 4), mats.paintBlue, -61, 5.8, Z + 4.4, 0, Math.PI / 4, 0);

  // ---------- 料道 ----------
  const fh0 = kx1, fh1 = FX - 0.8;
  const fhm = (fh0 + fh1) / 2, fhl = fh1 - fh0;
  b.box(fhl, 0.5, 2.4, C(tiled(mats.refractory, 6, 1)), fhm, ML - 0.65, Z);
  for (const zs of [-1, 1]) b.box(fhl, 1.1, 0.6, C(tiled(mats.azs, 8, 1)), fhm, ML + 0.1, Z + zs * 0.9);
  b.box(fhl, 0.35, 2.4, C(tiled(mats.refractory, 8, 1)), fhm, ML + 0.83, Z);
  b.box(fhl + 0.4, 0.2, 2.8, C(mats.steelDark), fhm, ML - 1.0, Z);
  for (let x = fh0 + 0.6; x < fh1; x += 0.6) for (const zs of [-1, 1]) b.rod(new THREE.Vector3(x, ML + 0.35, Z + zs * 1.5), new THREE.Vector3(x, ML + 0.35, Z + zs * 1.15), 0.035, C(mats.galv), 6);
  for (const zs of [-1, 1]) b.cyl(0.06, fhl, C(mats.paintYellow), fhm, ML + 0.35, Z + zs * 1.55, 'x', 8);
  // 料道平台（钢结构 + 栅格走台 + 栏杆）
  b.box(fhl + 6, 0.12, 4.6, mats.grating, fhm + 2, ML - 1.15, Z - 0.6);
  for (let x = fh0; x <= fh1 + 6; x += 3) {
    for (const z of [Z + 1.6, Z - 2.8]) b.hColumn(x, 0, ML - 1.2, z, 0.3, mats.steelFrame);
    b.box(0.05, 1.1, 0.05, mats.paintYellow, x, ML - 0.55, Z - 2.85);
  }
  b.box(fhl + 6, 0.05, 0.05, mats.paintYellow, fhm + 2, ML, Z - 2.85);
  b.box(fhl + 6, 0.05, 0.05, mats.paintYellow, fhm + 2, ML - 0.5, Z - 2.85);
  // ---------- 供料机 ----------
  b.add(new THREE.CylinderGeometry(0.8, 0.55, 1.1, 24), C(tiled(mats.azs, 2, 1)), FX, ML - 0.25, Z);
  b.add(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 24), C(mats.steelDark), FX, ML - 0.85, Z);
  b.box(1.4, 0.9, 1.4, machine, FX + 0.3, ML + 2.0, Z);
  b.box(0.3, 2.2, 0.3, machine, FX + 0.9, ML + 0.9, Z);
  b.cyl(0.25, 0.6, mats.motor, FX + 0.3, ML + 2.7, Z + 0.4);
  b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 16), C(mats.azs), FX, ML - 0.9, Z); // 料碗口（流料孔）
  // 剪刀机构
  b.box(1.6, 0.25, 0.6, machine, FX - 0.1, ML - 1.35, Z + 0.7);
  // ---------- 行列式制瓶机 ----------
  const mx0 = SX(0) - 1.25, mx1 = SX(SECTIONS - 1) + 1.25, mxm = (mx0 + mx1) / 2;
  for (let i = 0; i < SECTIONS; i++) {
    const x = SX(i);
    b.box(2.35, 1.3, 3.6, machine, x, 0.65, Z);
    b.box(2.2, 0.1, 3.4, mats.steelDark, x, 1.32, Z);
    // 初型模/成型模开合机构立柱
    for (const z of [ZB, ZW]) for (const sx of [-1, 1]) b.cyl(0.07, 0.9, mats.chrome, x + sx * 0.75, 1.75, z, 'y', 10);
    // 闷头 / 吹气头机构
    b.cyl(0.1, 2.6, machine, x + 0.85, 2.6, ZB, 'y', 12);
    b.cyl(0.1, 2.2, machine, x + 0.85, 2.4, ZW, 'y', 12);
    b.box(0.22, 0.22, 0.22, mats.motor, x + 0.85, 3.95, ZB);
    b.box(0.22, 0.22, 0.22, mats.motor, x + 0.85, 3.55, ZW);
    // 底模 + 冷却风
    b.cyl(0.13, 0.05, iron, x, YN - 0.6, ZW, 'y', 20);
    // 停留板（带冷却孔）
    b.box(0.5, 0.04, 0.5, mats.galv, x, CONV_Y + 0.02, Z - 2.4);
    // 取瓶机构座
    b.box(0.3, 1.6, 0.3, machine, x - 0.85, 2.1, Z - 1.9);
    // 料槽（溜槽）
    const curve = gobCurve(i);
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve.points.slice(1, 4).map((p) => p.clone().add(new THREE.Vector3(0, -0.09, 0)))), 30, 0.035, 6, false), mats.galv);
  }
  b.box(mx1 - mx0 + 0.6, 0.35, 0.5, machine, mxm, 4.15, ZB); // 上部横梁
  b.box(mx1 - mx0 + 0.6, 0.35, 0.5, machine, mxm, 3.75, ZW);
  for (const x of [mx0 - 0.2, mx1 + 0.2]) for (const z of [ZB, ZW]) b.box(0.3, 4.0, 0.3, machine, x, 2.0, z);
  b.box(1.0, 2.0, 0.8, mats.paintWhite, mx1 + 1.5, 1.0, Z + 2.2);
  b.box(0.7, 0.5, 0.02, mats.screen, mx1 + 1.5, 1.5, Z + 2.61);

  // ---------- 输送带 + 退火炉 + 检验 + 包装 ----------
  const cx0 = mx0 - 0.5, cx1 = 9;
  b.box(cx1 - cx0, 0.05, 0.6, mats.galv, (cx0 + cx1) / 2, CONV_Y - 0.02, CONV_Z);
  for (const dz of [-0.33, 0.33]) b.box(cx1 - cx0, 0.15, 0.05, mats.paintGray, (cx0 + cx1) / 2, CONV_Y - 0.08, CONV_Z + dz);
  for (let x = cx0 + 1; x < cx1; x += 2.5) b.box(0.1, CONV_Y - 0.1, 0.6, mats.steelFrame, x, (CONV_Y - 0.1) / 2, CONV_Z);
  const lx0 = -26, lx1 = -6;
  b.box(lx1 - lx0, 0.15, 2.6, mats.paintGray, (lx0 + lx1) / 2, 2.4, CONV_Z);
  b.box(lx1 - lx0, 1.3, 0.1, mats.paintGray, (lx0 + lx1) / 2, 1.8, CONV_Z - 1.3);
  b.box(lx1 - lx0, 0.6, 0.1, mats.paintGray, (lx0 + lx1) / 2, 0.75, CONV_Z + 1.3);
  b.box(lx1 - lx0, 0.5, 0.06, mats.windowGlass, (lx0 + lx1) / 2, 1.55, CONV_Z + 1.3);
  b.box(lx1 - lx0, 0.35, 0.1, mats.paintGray, (lx0 + lx1) / 2, 2.15, CONV_Z + 1.3);
  for (let x = lx0 + 1.5; x < lx1; x += 3) {
    b.cyl(0.35, 0.4, mats.paintBlue, x, 2.7, CONV_Z - 0.4);
    b.cyl(0.16, 0.35, mats.motor, x, 3.05, CONV_Z - 0.4);
  }
  for (let x = lx0; x < lx0 + 5; x += 0.5) b.cyl(0.025, 2.2, mats.heater, x, 2.1, CONV_Z, 'z', 6);
  // 检验机
  b.box(1.6, 0.3, 2.0, mats.paintWhite, -2, 2.4, CONV_Z);
  for (const dz of [-0.9, 0.9]) b.box(1.6, 2.1, 0.12, mats.paintWhite, -2, 1.3, CONV_Z + dz);
  b.box(1.2, 0.8, 0.04, mats.lampWhite, -2, 1.7, CONV_Z - 0.82);
  b.box(0.3, 0.25, 0.3, mats.steelDark, -2, 2.1, CONV_Z + 0.5);
  b.box(0.45, 0.6, 0.45, mats.paintRed, 0.3, 0.3, CONV_Z - 1.4); // 废品箱
  b.box(0.4, 0.3, 0.3, mats.paintGray, 0.3, CONV_Y + 0.15, CONV_Z + 0.75);
  // 包装（装箱、码垛）
  b.box(3.6, 2.4, 2.4, mats.paintBlue, 6.5, 1.2, CONV_Z);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) b.box(0.55, 0.45, 0.55, mats.sand, 10.6 + i * 0.58, 0.3 + k * 0.47, CONV_Z - 0.6 + j * 0.58);
  b.box(1.9, 0.15, 1.9, mats.paintOrange, 11.2, 0.07, CONV_Z);
  b.flush(g);

  // ---------- 熔窑 / 料道 玻璃液 ----------
  const meltTex = heatTexture([[-66, 1450], [-58, 1500], [-55, 1350], [-45, 1220], [-35, 1150]], -66, -35);
  const meltMat = C(new THREE.MeshStandardMaterial({ color: 0x281000, emissive: 0xffffff, emissiveMap: meltTex, emissiveIntensity: HEAT_MAX, roughness: 0.3 }));
  const addMelt = (xa, xb, w, y0, y1) => {
    const geo = new THREE.BoxGeometry(xb - xa, y1 - y0, w);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + (xa + xb) / 2 + 66) / 31, 0.5);
    const m = new THREE.Mesh(geo, meltMat);
    m.position.set((xa + xb) / 2, (y0 + y1) / 2, Z);
    g.add(m);
  };
  addMelt(kx0 + 0.5, kx1 - 0.5, 6.4, 3.9, ML);
  addMelt(fh0 - 0.5, fh1 + 0.2, 1.2, ML - 0.4, ML);
  {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.45, 0.6, 24), meltMat);
    bowl.position.set(FX, ML - 0.3, Z);
    g.add(bowl);
  }
  // 马蹄焰
  const flames = [-1, 1].map((zs) => {
    const mat = createFlameMaterial();
    const f = makeFlame(8, 0.7, mat);
    f.position.set(kx0 + 0.6, 5.6, Z + zs * 1.8);
    f.rotation.z = -Math.PI / 2 + zs * 0.0;
    f.scale.set(0.55, 1, 1);
    f.userData = { mat, zs };
    g.add(f);
    return f;
  });

  // ---------- 动态部件 ----------
  const wareGeo = wareGeometry();
  const sections = [];
  const halfB = [halfMold(0.17, 0.62, 1), halfMold(0.17, 0.62, -1)];
  const halfW = [halfMold(0.2, 0.6, 1), halfMold(0.2, 0.6, -1)];
  for (let i = 0; i < SECTIONS; i++) {
    const x = SX(i);
    const wareMat = new THREE.MeshStandardMaterial({ color: 0x2a1405, roughness: 0.25, emissive: new THREE.Color() });
    const ware = new THREE.Mesh(wareGeo, wareMat);
    ware.morphTargetInfluences = [0, 0];
    ware.castShadow = true;
    g.add(ware);
    const mk = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    const blank = halfB.map((geo, k) => mk(geo, iron, x, YN + 0.31, ZB));
    const blow = halfW.map((geo, k) => mk(geo, iron, x, YN - 0.3, ZW));
    // 模具夹持臂
    const blankArm = [-1, 1].map((s) => mk(new THREE.BoxGeometry(0.5, 0.12, 0.12), machine, x, YN + 0.31, ZB));
    const blowArm = [-1, 1].map((s) => mk(new THREE.BoxGeometry(0.5, 0.12, 0.12), machine, x, YN - 0.3, ZW));
    const baffle = mk(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 20), iron, x, 3.2, ZB);
    const baffleArm = mk(new THREE.BoxGeometry(0.9, 0.08, 0.12), machine, x + 0.42, 3.2, ZB);
    const blowhead = mk(new THREE.CylinderGeometry(0.11, 0.14, 0.16, 20), iron, x, 2.6, ZW);
    const blowheadArm = mk(new THREE.BoxGeometry(0.9, 0.08, 0.12), machine, x + 0.42, 2.6, ZW);
    // 翻转机构（口模）
    const invert = new THREE.Group();
    invert.position.set(x, YN, Z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 20), mats.chrome);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.02, 1.0);
    invert.add(ring);
    for (const sx of [-0.12, 0.12]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 1.0), machine);
      arm.position.set(sx, 0.02, 0.5);
      invert.add(arm);
    }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 12).rotateZ(Math.PI / 2), mats.chrome);
    invert.add(axle);
    g.add(invert);
    // 取瓶钳 + 臂
    const tong = mk(new THREE.BoxGeometry(0.16, 0.1, 0.16), mats.chrome, x, 2.5, ZW);
    const takeArm = mk(new THREE.BoxGeometry(0.07, 0.07, 1), machine, x, 2.5, ZW);
    const pusher = mk(new THREE.BoxGeometry(0.06, 0.18, 0.4), mats.paintOrange, x, CONV_Y + 0.12, Z - 2.4);
    sections.push({ x, ware, wareMat, blank, blow, blankArm, blowArm, baffle, baffleArm, blowhead, blowheadArm, invert, tong, takeArm, pusher, curve: gobCurve(i) });
  }

  // 供料机：冲头、剪刀、悬垂料滴、分料勺
  const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 14), C(mats.azs));
  g.add(plunger);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.2, 20, 1, true), C(mats.azs));
  tube.position.set(FX, ML + 0.1, Z);
  g.add(tube);
  const shears = [-1, 1].map((s) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.22), mats.chrome);
    m.position.set(FX, ML - 1.2, Z);
    g.add(m);
    return m;
  });
  const hangMat = new THREE.MeshStandardMaterial({ color: 0x2a1405, emissive: heatColor(1150), roughness: 0.3 });
  const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 1, 14), hangMat);
  g.add(hang);
  const scoop = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10, 1, true), mats.galv);
  g.add(scoop);

  // 输送带上的瓶子
  const bottleGeo = bottleGeometry();
  const POOL = 46;
  const bottles = Array.from({ length: POOL }, () => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xb8691e,
      roughness: 0.08,
      transmission: 0.75,
      thickness: 0.2,
      ior: 1.5,
      attenuationColor: new THREE.Color(0x6b3208),
      attenuationDistance: 0.4,
      emissive: new THREE.Color(),
      transparent: true,
    });
    const m = new THREE.Mesh(bottleGeo, mat);
    m.castShadow = true;
    g.add(m);
    return { m, mat };
  });
  const convT = (x) => piecewise([[-39, 620], [-27, 520], [-25, 565], [-20, 555], [-14, 420], [-6, 70], [8, 30]], x);
  const rejectArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.6), mats.paintRed);
  rejectArm.position.set(0.3, CONV_Y + 0.12, CONV_Z + 0.55);
  g.add(rejectArm);

  // ---------- 标签 ----------
  const lab = (t, s, x, y, z, st, temp) => {
    const l = makeLabel(t, { sub: s, temp });
    l.position.set(x, y, z);
    ctx.addLabel(l, st);
  };
  lab('瓶罐熔窑', '马蹄焰蓄热式', kxm, 8.6, Z, 'bottle', '~1500°C');
  lab('料道', '调温 · 均化', (fh0 + fh1) / 2, ML + 2.0, Z, 'bottle', '1250→1150°C');
  lab('供料机', '冲头挤料 · 剪刀剪切', FX, ML + 3.2, Z, 'bottle');
  lab('行列式制瓶机 IS', '4 组 · 吹-吹法', mxm, 5.0, Z, 'bottle');
  lab('初型模', '扑气 · 倒吹成型坯', SX(0), 3.0, ZB + 0.4, 'bottle');
  lab('成型模', '正吹成瓶', SX(3), 1.0, ZW - 0.8, 'bottle');
  lab('网带退火炉', '消除热应力', (lx0 + lx1) / 2, 3.6, CONV_Z, 'bottleQC', '560→60°C');
  lab('自动检验机', '尺寸 · 裂纹 · 结石', -2, 3.3, CONV_Z, 'bottleQC');
  lab('剔废', '不合格品回炉', 0.3, 1.0, CONV_Z - 1.6, 'bottleQC');
  lab('装箱码垛', '', 8.5, 3.2, CONV_Z, 'bottleQC');

  const col = new THREE.Color();
  const tmp = new THREE.Vector3();
  return {
    group: g,
    update(t, dt) {
      flames.forEach((f) => {
        const on = mod(t, 40) < 20 ? -1 : 1;
        const lp = mod(t, 20);
        f.userData.mat.uniforms.uTime.value = t;
        f.userData.mat.uniforms.uPower.value = f.userData.zs === on ? smooth((lp - 0.5) / 1.2) * (1 - smooth((lp - 19) / 1)) : 0;
        f.visible = f.userData.zs === on;
      });
      // 供料机：冲头周期运动、剪刀闭合、料滴悬垂成形
      const fc = mod(t, GAP);
      plunger.position.set(FX, ML + 0.6 + 0.35 * Math.cos((fc / GAP) * Math.PI * 2), Z);
      tube.rotation.y += dt * 0.6;
      const cut = Math.exp(-Math.pow(Math.min(fc, GAP - fc) / 0.06, 2));
      shears[0].position.x = FX - 0.32 + cut * 0.29;
      shears[1].position.x = FX + 0.32 - cut * 0.29;
      const grow = fc / GAP;
      hang.scale.set(1, Math.max(0.01, 0.15 + grow * 0.5), 1);
      hang.position.set(FX, ML - 0.95 - hang.scale.y / 2 + 0.05, Z);
      const nextSec = mod(Math.floor(t / GAP) + 1, SECTIONS);
      const target = SX(nextSec);
      scoop.position.set(FX + (target - FX) * 0.12, ML - 1.6, Z + 0.2);
      scoop.rotation.set(0.5, 0, -(target - FX) * 0.08);

      for (let i = 0; i < SECTIONS; i++) updateSection(sections[i], mod(t - i * GAP, CYCLE));

      // 输送带瓶子：第 n 个瓶子在 tn = 6 + 1.5 n 被推上输送带
      const nNow = Math.floor((t - CYCLE) / GAP);
      bottles.forEach((o) => (o.m.visible = false));
      for (let n = nNow; n > nNow - POOL; n--) {
        const o = bottles[mod(n, POOL)];
        const age = t - (CYCLE + GAP * n);
        const sec = mod(n, SECTIONS);
        const x = SX(sec) + 0.4 + V_CONV * age;
        if (age < 0 || x > 6) continue;
        o.m.visible = true;
        let z = CONV_Z, rx = 0, y = CONV_Y;
        if (mod(n, 13) === 7 && x > 0.1) {
          const u = clamp((x - 0.1) / 0.5, 0, 1);
          z = CONV_Z - u * 1.1;
          rx = -u * 1.2;
          y = CONV_Y - u * u * 0.7;
          if (u >= 1) o.m.visible = false;
        }
        o.m.position.set(x, y, z);
        o.m.rotation.set(rx, 0, 0);
        heatColor(convT(x), col);
        o.mat.emissive.copy(col);
      }
      // 剔废推杆
      let kick = 0;
      for (let n = nNow; n > nNow - POOL; n--) {
        if (mod(n, 13) !== 7) continue;
        const x = SX(mod(n, SECTIONS)) + 0.4 + V_CONV * (t - (CYCLE + GAP * n));
        kick = Math.max(kick, Math.exp(-Math.pow((x - 0.35) / 0.25, 2)));
      }
      rejectArm.position.z = CONV_Z + 0.55 - kick * 0.45;
    },
  };

  function updateSection(s, c) {
    const { x, ware, wareMat } = s;
    // --- 模具开合 ---
    const blankOpen = smooth((c - 1.7) / 0.3) * (1 - smooth((c - 2.9) / 0.4));
    const blowOpen = 1 - smooth((c - 2.8) / 0.3) + smooth((c - 4.1) / 0.3);
    s.blank.forEach((m, k) => (m.position.x = x + (k ? -1 : 1) * blankOpen * 0.28));
    s.blankArm.forEach((m, k) => (m.position.x = x + (k ? -1 : 1) * (0.42 + blankOpen * 0.28)));
    s.blow.forEach((m, k) => (m.position.x = x + (k ? -1 : 1) * clamp(blowOpen, 0, 1) * 0.3));
    s.blowArm.forEach((m, k) => (m.position.x = x + (k ? -1 : 1) * (0.45 + clamp(blowOpen, 0, 1) * 0.3)));
    // 闷头：0.7–1.7 s 压下
    const bd = smooth((c - 0.7) / 0.15) * (1 - smooth((c - 1.6) / 0.15));
    s.baffle.position.y = lerp(3.25, YN + 0.66, bd);
    s.baffleArm.position.y = s.baffle.position.y + 0.06;
    // 吹气头：3.1–4.2 s 压下
    const hd = smooth((c - 3.1) / 0.2) * (1 - smooth((c - 4.05) / 0.2));
    s.blowhead.position.y = lerp(2.75, YN + 0.08, hd);
    s.blowheadArm.position.y = s.blowhead.position.y + 0.06;
    // 翻转：2.0–2.8 s 翻转 180°，3.1–3.8 s 返回
    const inv = c < 3.1 ? easeInOut((c - 2.0) / 0.8) : 1 - easeInOut((c - 3.1) / 0.7);
    s.invert.rotation.x = -Math.PI * inv;

    // --- 料坯 / 瓶 ---
    let T = 1150;
    ware.visible = true;
    ware.morphTargetInfluences[0] = 0;
    ware.morphTargetInfluences[1] = 0;
    ware.rotation.set(0, 0, 0);
    if (c < 0.7) {
      // 料滴沿溜槽滑落进入初型模
      const u = clamp(c / 0.7, 0, 1);
      s.curve.getPoint(u * u, tmp);
      ware.position.copy(tmp);
    } else if (c < 2.0) {
      ware.position.set(x, YN, ZB);
      ware.morphTargetInfluences[0] = smooth((c - 1.0) / 0.7);
      T = 1100 - ware.morphTargetInfluences[0] * 80;
    } else if (c < 3.3) {
      // 随口模翻转到成型侧
      const th = Math.PI * (c < 2.8 ? easeInOut((c - 2.0) / 0.8) : 1);
      ware.position.set(x, YN + Math.sin(th), Z + Math.cos(th));
      ware.rotation.x = -th;
      ware.morphTargetInfluences[0] = 1;
      ware.morphTargetInfluences[0] = 1 - smooth((c - 2.8) / 0.5) * 0.05;
      T = 1020;
    } else if (c < 4.4) {
      // 正吹：初型 → 成品瓶
      ware.position.set(x, YN, ZW);
      ware.rotation.x = -Math.PI;
      const w = smooth((c - 3.3) / 0.8);
      ware.morphTargetInfluences[0] = 1 - w;
      ware.morphTargetInfluences[1] = w;
      T = 1000 - w * 280;
    } else if (c < 5.6) {
      // 钳瓶：越过模具放到停留板
      const u = easeInOut((c - 4.4) / 0.8);
      ware.morphTargetInfluences[1] = 1;
      ware.rotation.x = -Math.PI;
      const y0 = YN, y1 = CONV_Y + 0.04 + 0.55;
      ware.position.set(x, lerp(y0, y1, u) + Math.sin(u * Math.PI) * 0.5, lerp(ZW, Z - 2.4, u));
      T = 700 - u * 60;
    } else {
      // 推瓶到输送带
      const u = easeInOut((c - 5.6) / 0.4);
      ware.morphTargetInfluences[1] = 1;
      ware.rotation.x = -Math.PI;
      ware.position.set(x + u * 0.4, CONV_Y + 0.04 + 0.55, lerp(Z - 2.4, CONV_Z, u));
      T = 630;
      if (u >= 0.999) ware.visible = false;
    }
    heatColor(T, col);
    wareMat.emissive.copy(col);
    // 取瓶钳与臂
    const takeU = c >= 4.25 && c < 5.25 ? easeInOut((c - 4.4) / 0.8) : c >= 5.25 ? 1 - easeInOut((c - 5.25) / 0.6) : 0;
    const tongPos = c >= 4.4 && c < 5.2 ? tmp.copy(ware.position).add(new THREE.Vector3(0, 0.06, 0)) : tmp.set(x, lerp(2.7, CONV_Y + 0.7, takeU), lerp(ZW, Z - 2.4, takeU));
    s.tong.position.copy(tongPos);
    const pivot = new THREE.Vector3(x - 0.85, 2.9, Z - 1.9);
    const dir = tongPos.clone().sub(pivot);
    s.takeArm.position.copy(pivot).addScaledVector(dir, 0.5);
    s.takeArm.scale.set(1, 1, dir.length());
    s.takeArm.lookAt(tongPos);
    // 拨瓶器
    const pu = c >= 5.6 ? easeInOut((c - 5.6) / 0.4) : c < 0.4 ? 1 - smooth(c / 0.4) : 0;
    s.pusher.position.set(x - 0.15 + pu * 0.4, CONV_Y + 0.12, lerp(Z - 2.15, CONV_Z + 0.25, pu));
  }
}

/** 料滴从剪刀经分料器、溜槽落入第 i 组初型模的路径 */
function gobCurve(i) {
  const x = SX(i);
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(FX, ML - 1.3, Z),
    new THREE.Vector3(FX + (x - FX) * 0.12, ML - 1.75, Z + 0.25),
    new THREE.Vector3(FX + (x - FX) * 0.6, 3.6, ZB + 0.05),
    new THREE.Vector3(x, 2.95, ZB),
    new THREE.Vector3(x, YN + 0.02, ZB),
  ]);
}
