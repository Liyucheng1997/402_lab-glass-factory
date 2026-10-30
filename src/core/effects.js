import * as THREE from 'three';

/** 火焰：沿局部 +Y 方向伸展的锥体，叠加噪声闪烁，HDR 输出用于泛光 */
export function createFlameMaterial({ hot = [2.2, 1.7, 0.9], mid = [1.8, 0.65, 0.1], cool = [0.7, 0.1, 0.02], blue = 0.0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 1 },
      uHot: { value: new THREE.Vector3(...hot) },
      uMid: { value: new THREE.Vector3(...mid) },
      uCool: { value: new THREE.Vector3(...cool) },
      uBlue: { value: blue },
      uSeed: { value: Math.random() * 10 },
    },
    vertexShader: /* glsl */ `
      varying float vH;
      varying vec2 vP;
      uniform float uTime; uniform float uSeed;
      void main(){
        vH = uv.y;
        vP = vec2(atan(position.x, position.z), position.y);
        vec3 p = position;
        float w = sin(position.y * 3.0 - uTime * 9.0 + uSeed) * 0.06 * (1.0 - uv.y);
        p.x += w; p.z += w * 0.6;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vH;
      varying vec2 vP;
      uniform float uTime; uniform float uPower; uniform float uSeed; uniform float uBlue;
      uniform vec3 uHot; uniform vec3 uMid; uniform vec3 uCool;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float h = 1.0 - vH;               // 0 = 喷口, 1 = 焰尖
        vec2 q = vec2(vP.x * 2.0, vP.y * 1.4 - uTime * 3.2 + uSeed);
        float n = noise(q) * 0.6 + noise(q * 2.3) * 0.4;
        float a = smoothstep(1.0, 0.25, h + (n - 0.5) * 0.55) * uPower;
        vec3 col = mix(uHot, uMid, smoothstep(0.0, 0.45, h));
        col = mix(col, uCool, smoothstep(0.45, 1.0, h));
        col = mix(col, vec3(0.3, 0.6, 2.2), uBlue * smoothstep(0.25, 0.0, h));
        gl_FragColor = vec4(col * (0.45 + n * 0.6), a * 0.55);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** 生成一根火焰网格：从原点沿 dir 方向伸出 */
export function makeFlame(length, radius, material) {
  const geo = new THREE.ConeGeometry(radius, length, 20, 10, true);
  geo.translate(0, length / 2, 0); // 底部在原点
  // ConeGeometry 的 uv.y：底部 0 → 顶部 1，翻转为 底=1 顶=0 以便着色器中 vH=1 为喷口
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  return new THREE.Mesh(geo, material);
}

/** 简单粒子系统（气流、水雾、火花），粒子沿各自的速度运动并循环 */
export class Spray {
  constructor({ count = 200, color = [0.6, 0.8, 1.6], size = 0.06, opacity = 0.7, additive = true }) {
    this.count = count;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({
      color: new THREE.Color(...color),
      size,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      map: dotTexture(),
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.seeds = new Float32Array(count * 4).map(() => Math.random());
  }
  /** fn(i, seeds, out) 根据时间写入粒子位置 */
  update(fn) {
    const out = [0, 0, 0];
    for (let i = 0; i < this.count; i++) {
      fn(i, this.seeds.subarray(i * 4, i * 4 + 4), out);
      this.pos[i * 3] = out[0];
      this.pos[i * 3 + 1] = out[1];
      this.pos[i * 3 + 2] = out[2];
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

let _dot;
export function dotTexture() {
  if (_dot) return _dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _dot = new THREE.CanvasTexture(c);
  return _dot;
}

/** 钢化玻璃应力光弹（偏光）图样：喷嘴阵列形成的"风斑" + 边部应力带 */
export function createStressMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: 1 }, uSize: { value: new THREE.Vector2(2, 1.4) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform float uStrength; uniform vec2 uSize;
      vec3 pal(float t){ return 0.5 + 0.5*cos(6.28318*(vec3(1.0,1.0,1.0)*t + vec3(0.0,0.33,0.67))); }
      void main(){
        vec2 p = vUv * uSize;
        float spots = sin(p.x * 9.0) * sin(p.y * 9.0 + 0.8) + 0.45 * sin((p.x + p.y) * 6.3);
        vec2 e = min(vUv, 1.0 - vUv) * uSize;
        float edge = exp(-min(e.x, e.y) * 12.0);
        float s = (spots * 0.35 + 0.55 + edge * 1.4) * uStrength;
        vec3 col = mix(vec3(0.06,0.07,0.1), pal(s * 0.9 + 0.1), smoothstep(0.0, 0.25, uStrength));
        gl_FragColor = vec4(col * 1.15, 0.92);
      }`,
    transparent: true,
  });
}
