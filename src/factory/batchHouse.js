import * as THREE from 'three';
import { Batch, makeLabel, mod } from '../core/util.js';

// 原料：名称、化学式、颜色、在配合料中的作用
export const RAW = [
  { name: '石英砂', f: 'SiO₂', color: 0xe6dcc4, role: '网络形成体' },
  { name: '纯碱', f: 'Na₂CO₃', color: 0xf7f7f2, role: '助熔剂' },
  { name: '石灰石', f: 'CaCO₃', color: 0xcfcac0, role: '稳定剂' },
  { name: '白云石', f: 'CaMg(CO₃)₂', color: 0xb9b3a6, role: '稳定剂' },
  { name: '芒硝', f: 'Na₂SO₄', color: 0xe9efe6, role: '澄清剂' },
];

/** 原料车间：筒仓、称量、混合机、斜皮带与投料机 */
export function buildBatchHouse(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  g.name = 'batchHouse';
  const b = new Batch();
  const siloX = [-99, -95, -91, -87, -83];
  const siloZ = -2.5;
  const R = 1.6, H = 9, legH = 4.2;

  siloX.forEach((x, i) => {
    // 筒体 + 锥斗 + 顶盖
    b.add(new THREE.CylinderGeometry(R, R, H, 32), mats.paintWhite, x, legH + 1.6 + H / 2, siloZ);
    b.add(new THREE.CylinderGeometry(R, 0.3, 1.6, 32), mats.paintWhite, x, legH + 0.8, siloZ);
    b.add(new THREE.ConeGeometry(R + 0.05, 0.6, 32), mats.paintGray, x, legH + 1.6 + H + 0.3, siloZ);
    // 加强环
    for (let k = 0; k < 4; k++) b.add(new THREE.TorusGeometry(R + 0.02, 0.05, 6, 40), mats.paintGray, x, legH + 2.2 + k * 2.4, siloZ, Math.PI / 2, 0, 0);
    // 支腿与斜撑
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      b.hColumn(x + dx * 1.15, 0, legH + 1.8, siloZ + dz * 1.15, 0.28, mats.steelFrame);
    }
    b.rod(new THREE.Vector3(x - 1.15, 0.3, siloZ + 1.15), new THREE.Vector3(x + 1.15, legH, siloZ + 1.15), 0.05, mats.steelFrame, 6);
    // 螺旋给料机 + 称量斗（带称重传感器）
    b.cyl(0.18, 1.2, mats.galv, x, legH - 0.1, siloZ, 'z');
    b.cyl(0.22, 0.5, mats.motor, x, legH - 0.1, siloZ + 0.85, 'z');
    b.add(new THREE.CylinderGeometry(0.7, 0.25, 1.1, 4, 1), mats.paintBlue, x, 2.65, siloZ, 0, Math.PI / 4, 0);
    b.box(1.2, 0.12, 1.2, mats.steelDark, x, 3.25, siloZ);
    for (const dz of [-0.5, 0.5]) b.box(0.15, 0.2, 0.15, mats.paintYellow, x + 0.5, 3.1, siloZ + dz);
    b.cyl(0.1, 0.5, mats.galv, x, 1.85, siloZ);

    const lbl = makeLabel(RAW[i].name, { sub: RAW[i].f });
    lbl.position.set(x, legH + 1.6 + H + 1.2, siloZ);
    ctx.addLabel(lbl, 'batch');
  });

  // 碎玻璃仓（回用）
  const cx = -88, cz = -8.2;
  b.add(new THREE.CylinderGeometry(1.4, 1.4, 6, 4, 1), mats.paintGreen, cx, 6.5, cz, 0, Math.PI / 4, 0);
  b.add(new THREE.CylinderGeometry(1.4, 0.3, 1.6, 4, 1), mats.paintGreen, cx, 2.7, cz, 0, Math.PI / 4, 0);
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.hColumn(cx + dx * 0.95, 0, 4, cz + dz * 0.95, 0.24, mats.steelFrame);
  const cl = makeLabel('碎玻璃仓', { sub: '回用约20–30%' });
  cl.position.set(cx, 10.6, cz);
  ctx.addLabel(cl, 'batch');

  // 顶部输送廊道 + 斗式提升机
  b.box(22, 1.4, 2.2, mats.cladding, -91, legH + 1.6 + H + 1.3, siloZ);
  b.box(1.8, 17.5, 1.8, mats.paintBlue, -102.6, 8.75, siloZ);
  b.box(2.2, 1.2, 2.2, mats.motor, -102.6, 18, siloZ);
  // 平台与栏杆
  b.box(22, 0.08, 1.4, mats.grating, -91, 3.35, siloZ + 2.0);
  for (let x = -101.5; x <= -80.5; x += 1.5) b.box(0.05, 1.1, 0.05, mats.paintYellow, x, 3.95, siloZ + 2.65);
  b.box(22, 0.05, 0.05, mats.paintYellow, -91, 4.5, siloZ + 2.65);
  b.box(22, 0.05, 0.05, mats.paintYellow, -91, 4.0, siloZ + 2.65);

  // 集料皮带（筒仓下方）→ 混合机
  const beltY = 1.3;
  const belt0 = -101, belt1 = -80.5;
  b.box(belt1 - belt0, 0.08, 0.9, mats.belt, (belt0 + belt1) / 2, beltY, siloZ);
  b.box(belt1 - belt0, 0.3, 0.08, mats.paintGray, (belt0 + belt1) / 2, beltY - 0.05, siloZ - 0.5);
  b.box(belt1 - belt0, 0.3, 0.08, mats.paintGray, (belt0 + belt1) / 2, beltY - 0.05, siloZ + 0.5);
  for (let x = belt0; x <= belt1; x += 2) {
    b.box(0.08, beltY - 0.2, 0.08, mats.steelFrame, x, (beltY - 0.2) / 2, siloZ - 0.5);
    b.box(0.08, beltY - 0.2, 0.08, mats.steelFrame, x, (beltY - 0.2) / 2, siloZ + 0.5);
  }
  // 碎玻璃给料皮带
  b.box(0.7, 0.08, 5.4, mats.belt, cx, 1.55, (cz + siloZ) / 2 - 0.3);

  // 混合机（强制式）
  const mx = -78.6;
  b.box(3.2, 2.2, 3.2, mats.paintBlue, mx, 2.5, 0);
  b.add(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 32), mats.paintGray, mx, 3.75, 0);
  b.cyl(0.45, 1.2, mats.motor, mx + 0.6, 4.4, 0.6);
  b.add(new THREE.CylinderGeometry(0.8, 0.25, 0.9, 4), mats.paintBlue, mx, 0.95, 0, 0, Math.PI / 4, 0);
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.hColumn(mx + dx * 1.4, 0, 1.4, dz * 1.4, 0.25, mats.steelFrame);
  b.box(1.2, 0.15, 1.2, mats.steelDark, mx, 0.42, 0);
  const ml = makeLabel('混合机', { sub: '配合料均化' });
  ml.position.set(mx, 5.4, 0);
  ctx.addLabel(ml, 'batch');

  // 斜皮带：混合机 → 窑头料仓
  const A = new THREE.Vector3(-77.2, 0.6, 0);
  const B = new THREE.Vector3(-69.6, 6.3, 0);
  const dir = B.clone().sub(A);
  const L = dir.length();
  const ang = Math.atan2(dir.y, dir.x);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  b.add(new THREE.BoxGeometry(L, 0.08, 0.9), mats.belt, mid.x, mid.y, mid.z, 0, 0, ang);
  for (const dz of [-0.55, 0.55]) {
    b.add(new THREE.BoxGeometry(L, 0.45, 0.08), mats.paintGray, mid.x, mid.y + 0.05, dz, 0, 0, ang);
    b.add(new THREE.BoxGeometry(L, 0.05, 0.05), mats.paintYellow, mid.x, mid.y + 1.1, dz + Math.sign(dz) * 0.3, 0, 0, ang);
  }
  for (let s = 0.12; s < 1; s += 0.22) {
    const p = A.clone().lerp(B, s);
    for (const dz of [-0.55, 0.55]) b.box(0.12, p.y, 0.12, mats.steelFrame, p.x, p.y / 2, dz);
  }

  // 窑头料仓 + 投料机（推杆式）
  b.add(new THREE.CylinderGeometry(1.3, 0.5, 2.0, 4), mats.paintBlue, -68.4, 5.0, 0, 0, Math.PI / 4, 0);
  b.box(2.2, 1.7, 3.6, mats.paintBlue, -68.4, 2.5, 0);
  b.box(2.4, 0.2, 4.0, mats.steelDark, -68.4, 1.55, 0);
  for (const dz of [-1.6, 1.6]) for (const dx of [-0.9, 0.9]) b.box(0.2, 1.5, 0.2, mats.steelFrame, -68.4 + dx, 0.75, dz);
  b.cyl(0.35, 1.0, mats.motor, -69.4, 3.0, 1.2, 'x');
  b.flush(g);

  // 投料推板（往复运动）
  const pusher = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 3.2), mats.galv);
  pusher.position.set(-67.2, 2.0, 0);
  pusher.castShadow = true;
  g.add(pusher);
  const ch = makeLabel('投料机', { sub: '推入熔窑投料口' });
  ch.position.set(-68.4, 6.6, 1.8);
  ctx.addLabel(ch, 'batch');

  // 皮带上的物料颗粒（不同原料用不同颜色，混合后为均匀的配合料）
  const per = 18;
  const rawGeo = new THREE.BoxGeometry(0.28, 0.12, 0.3);
  const rawMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  const rawCount = per * RAW.length;
  const rawMesh = new THREE.InstancedMesh(rawGeo, rawMat, rawCount);
  const col = new THREE.Color();
  for (let i = 0; i < rawCount; i++) rawMesh.setColorAt(i, col.set(RAW[i % RAW.length].color));
  g.add(rawMesh);

  const mixCount = 46;
  const mixMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.14, 0.42), mats.batch, mixCount);
  g.add(mixMesh);
  const culletCount = 10;
  const culletMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.14, 0), mats.cullet, culletCount);
  g.add(culletMesh);

  const d = new THREE.Object3D();
  return {
    group: g,
    update(t) {
      // 原料颗粒：从各自称量斗落到集料皮带，再向混合机移动
      const v = 1.1;
      for (let i = 0; i < rawCount; i++) {
        const k = i % RAW.length;
        const j = Math.floor(i / RAW.length);
        const startX = siloX[k];
        const span = belt1 - startX;
        const s = mod(t * v + (j / per) * 20, 20);
        if (s > span) {
          d.scale.setScalar(0.0001);
        } else {
          d.scale.setScalar(1);
        }
        d.position.set(startX + s, beltY + 0.1, siloZ + ((j % 3) - 1) * 0.22);
        d.rotation.set(0, j, 0);
        d.updateMatrix();
        rawMesh.setMatrixAt(i, d.matrix);
      }
      rawMesh.instanceMatrix.needsUpdate = true;
      // 混合料：斜皮带上行
      for (let i = 0; i < mixCount; i++) {
        const s = mod(t * 0.07 + i / mixCount, 1);
        const p = A.clone().lerp(B, s);
        d.position.set(p.x, p.y + 0.12, ((i % 3) - 1) * 0.25);
        d.rotation.set(0, 0, ang);
        d.scale.setScalar(1);
        d.updateMatrix();
        mixMesh.setMatrixAt(i, d.matrix);
      }
      mixMesh.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < culletCount; i++) {
        const s = mod(t * 0.3 + i / culletCount, 1);
        d.position.set(cx + ((i % 2) - 0.5) * 0.3, 1.67, cz + s * 5.2);
        d.rotation.set(i, i * 2, 0);
        d.updateMatrix();
        culletMesh.setMatrixAt(i, d.matrix);
      }
      culletMesh.instanceMatrix.needsUpdate = true;
      // 推杆投料：约 4 秒一个行程
      const c = mod(t, 4) / 4;
      pusher.position.x = -67.6 + Math.sin(c * Math.PI) * 1.2;
    },
  };
}
