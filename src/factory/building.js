import * as THREE from 'three';
import { Batch, mesh, makeWorker } from '../core/util.js';
import { HALL } from '../core/layout.js';
import { tiled } from '../core/materials.js';

/** 厂房：钢结构柱网、屋架、吊车梁、地坪、行车与外部设施 */
export function buildBuilding(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  g.name = 'building';
  const b = new Batch();
  const { x0, x1, rows, span, height } = HALL;
  const len = x1 - x0;

  // 地面：室外场地 + 厂房环氧/混凝土地坪
  const ground = mesh(new THREE.PlaneGeometry(700, 700), mats.ground, 0, -0.02, 0, { cast: false });
  ground.rotation.x = -Math.PI / 2;
  g.add(ground);
  const floorMat = tiled(mats.floor, len / 6, (rows[3] - rows[0]) / 6);
  const floor = mesh(new THREE.PlaneGeometry(len, rows[3] - rows[0]), floorMat, (x0 + x1) / 2, 0, (rows[0] + rows[3]) / 2, { cast: false });
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);

  // 地面标线：人行通道（黄色）
  const lines = new Batch();
  const stripe = (xa, xb, z, w = 0.12) => lines.box(xb - xa, 0.01, w, mats.lineYellow, (xa + xb) / 2, 0.006, z);
  const stripeZ = (za, zb, x, w = 0.12) => lines.box(w, 0.01, zb - za, mats.lineYellow, x, 0.006, (za + zb) / 2);
  for (const z of [-13.6, -15.6, 12, 14, 20.5, 22.5, -22, -24, 35.5, 37.5]) stripe(x0 + 4, x1 - 4, z);
  for (const x of [-72, -70, 76, 74]) stripeZ(rows[0] + 3, rows[3] - 3, x);
  lines.flush(g, { cast: false });

  // 柱网：H 型钢柱
  const colMat = mats.steelFrame;
  for (const z of rows) {
    for (let x = x0 + 4; x <= x1 + 0.1; x += span) {
      b.hColumn(x, 0, height, z, 0.55, colMat);
      b.box(0.9, 0.3, 0.9, mats.plinth, x, 0.15, z); // 柱脚混凝土墩
      // 吊车牛腿
      if ((z === rows[1] || z === rows[2]) && x > 38) {
        b.box(0.5, 0.5, 0.9, colMat, x, 10.2, z + (z === rows[1] ? 0.6 : -0.6));
      }
    }
  }
  // 吊车梁（冷端跨与原料跨）
  for (const z of [rows[1] + 0.9, rows[2] - 0.9]) {
    b.box(38, 0.9, 0.4, mats.paintYellow, 59, 10.9, z);
    b.box(38, 0.08, 0.12, mats.galv, 59, 11.39, z);
  }

  // 屋架：每根柱线一榀三角形钢屋架（单独成组，相机升到屋顶以上时自动隐藏）
  b.flush(g);
  const roof = new THREE.Group();
  for (let x = x0 + 4; x <= x1 + 0.1; x += span) {
    for (let i = 0; i < rows.length - 1; i++) {
      const za = rows[i], zb = rows[i + 1];
      const zm = (za + zb) / 2;
      const rise = 2.6;
      const yb = height;
      const A = new THREE.Vector3(x, yb, za), B = new THREE.Vector3(x, yb, zb), Cn = new THREE.Vector3(x, yb + rise, zm);
      b.beam(A, B, 0.22, 0.22, colMat);
      b.beam(new THREE.Vector3(x, yb + 0.6, za), Cn, 0.22, 0.22, colMat);
      b.beam(new THREE.Vector3(x, yb + 0.6, zb), Cn, 0.22, 0.22, colMat);
      const n = 8;
      for (let k = 1; k < n; k++) {
        const z = za + ((zb - za) * k) / n;
        const t = 1 - Math.abs(z - zm) / (zm - za);
        const yt = yb + 0.6 + (rise - 0.6) * t;
        b.rod(new THREE.Vector3(x, yb, z), new THREE.Vector3(x, yt, z), 0.05, colMat, 6);
        const z2 = za + ((zb - za) * (k + (z < zm ? 1 : -1))) / n;
        const t2 = 1 - Math.abs(z2 - zm) / (zm - za);
        b.rod(new THREE.Vector3(x, yb, z), new THREE.Vector3(x, yb + 0.6 + (rise - 0.6) * t2, z2), 0.04, colMat, 6);
      }
    }
  }
  // 檩条
  for (let i = 0; i < rows.length - 1; i++) {
    const za = rows[i], zb = rows[i + 1], zm = (za + zb) / 2;
    for (let k = 0; k <= 8; k++) {
      const z = za + ((zb - za) * k) / 8;
      const t = 1 - Math.abs(z - zm) / (zm - za);
      const y = height + 0.6 + 2.0 * t + 0.15;
      b.box(len - 8, 0.18, 0.1, mats.galv, (x0 + x1) / 2 + 0, y, z);
    }
  }
  b.flush(roof);
  g.add(roof);
  // 纵向系杆与柱间支撑
  for (const z of rows) {
    b.box(len - 8, 0.25, 0.25, colMat, (x0 + x1) / 2, height - 0.1, z);
    for (const xa of [x0 + 4, x1 - 8]) {
      b.rod(new THREE.Vector3(xa, 0.5, z), new THREE.Vector3(xa + span, height - 0.5, z), 0.05, colMat, 6);
      b.rod(new THREE.Vector3(xa + span, 0.5, z), new THREE.Vector3(xa, height - 0.5, z), 0.05, colMat, 6);
    }
  }
  // 两侧围护：矮墙 + 彩钢板（仅远侧外墙做到顶，近侧留开敞以便观察）
  const wallMat = tiled(mats.cladding, len / 2, 3);
  const farWall = mesh(new THREE.PlaneGeometry(len, 9), wallMat, (x0 + x1) / 2 + 2, 5.7, rows[0] - 0.3, { cast: false });
  g.add(farWall);
  b.box(len, 1.2, 0.3, mats.plinth, (x0 + x1) / 2 + 2, 0.6, rows[0] - 0.3);
  b.box(len, 0.8, 0.3, mats.plinth, (x0 + x1) / 2 + 2, 0.4, rows[3] + 0.3);
  // 远侧墙的条形窗
  for (let x = x0 + 10; x < x1; x += span) b.box(8, 1.6, 0.06, mats.windowGlass, x, 7.6, rows[0] - 0.12);

  b.flush(g);

  // 桥式起重机（冷端跨）
  const crane = new THREE.Group();
  const cb = new Batch();
  const spanZ = rows[2] - rows[1] - 1.8;
  cb.box(1.0, 1.2, spanZ, mats.paintYellow, -1.2, 0, 0);
  cb.box(1.0, 1.2, spanZ, mats.paintYellow, 1.2, 0, 0);
  cb.box(3.6, 0.8, 1.0, mats.paintYellow, 0, -0.1, -spanZ / 2);
  cb.box(3.6, 0.8, 1.0, mats.paintYellow, 0, -0.1, spanZ / 2);
  cb.box(3.4, 0.12, spanZ - 0.4, mats.hazard, 0, 0.66, 0);
  cb.flush(crane);
  const trolley = new THREE.Group();
  const tb = new Batch();
  tb.box(3.2, 0.9, 2.2, mats.paintOrange, 0, 1.0, 0);
  tb.cyl(0.35, 1.8, mats.motor, 0, 1.0, 0.0, 'x');
  tb.rod(new THREE.Vector3(-0.3, 0.6, 0), new THREE.Vector3(-0.3, -5, 0), 0.025, mats.steelDark, 5);
  tb.rod(new THREE.Vector3(0.3, 0.6, 0), new THREE.Vector3(0.3, -5, 0), 0.025, mats.steelDark, 5);
  tb.box(0.9, 0.6, 0.4, mats.paintYellow, 0, -5.2, 0);
  tb.flush(trolley);
  crane.add(trolley);
  crane.position.set(60, 11.6, (rows[1] + rows[2]) / 2);
  g.add(crane);

  // 烟囱与室外站房
  const ext = new Batch();
  ext.add(new THREE.CylinderGeometry(1.6, 2.6, 46, 28), mats.redBrick, -56, 23, -50);
  ext.add(new THREE.CylinderGeometry(1.75, 1.75, 1.2, 28), mats.steelDark, -56, 45.5, -50);
  for (let y = 6; y < 44; y += 6) ext.add(new THREE.TorusGeometry(2.6 - (y / 46) * 1.0 + 0.02, 0.06, 6, 36), mats.steelDark, -56, y, -50, Math.PI / 2, 0, 0);
  // 天然气/氧气储罐
  for (const [x, z] of [[-86, -52], [-80, -52]]) {
    ext.add(new THREE.CylinderGeometry(1.6, 1.6, 9, 24), mats.paintWhite, x, 2.2, z, 0, 0, Math.PI / 2);
    ext.add(new THREE.SphereGeometry(1.6, 20, 12), mats.paintWhite, x - 4.5, 2.2, z);
    ext.add(new THREE.SphereGeometry(1.6, 20, 12), mats.paintWhite, x + 4.5, 2.2, z);
    for (const dx of [-3, 0, 3]) ext.box(0.4, 1.0, 2.2, mats.plinth, x + dx, 0.5, z);
  }
  // 原料堆棚（室外）
  ext.box(22, 0.4, 14, mats.plinth, -120, 0.2, 0);
  for (const [x, z, c] of [[-125, -3, mats.sand], [-117, -3, mats.batch], [-125, 4, mats.batch], [-117, 4, mats.sand]]) {
    ext.add(new THREE.ConeGeometry(3.2, 2.6, 24), c, x, 1.7, z);
  }
  ext.flush(g);

  // 工人（体现尺度）
  const workers = [
    [-74, 6, 0.6], [-62, -7.5, 2.2], [-20, 5.6, -1.2], [30, -4.6, 1.6], [47, 3.4, 3.0], [70, -6.5, 0.4],
    [-26, 24.3, 1.4], [9, 24.4, -2.5], [47, 30.5, 2.6], [-33, -25.7, 0.4], [-6, -33.5, -1.5], [6, -27.6, 2.2],
  ];
  workers.forEach(([x, z, r], i) => {
    const w = makeWorker(mats, i % 3 === 0 ? 'blue' : 'orange');
    w.position.set(x, 0, z);
    w.rotation.y = r;
    g.add(w);
  });

  return {
    group: g,
    roof,
    update(t) {
      crane.position.x = 58 + Math.sin(t * 0.05) * 12;
      trolley.position.z = Math.sin(t * 0.09) * 9;
    },
  };
}
