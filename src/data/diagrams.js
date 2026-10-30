// 讲解面板中的原理示意图（内联 SVG，颜色全部取自 CSS 变量，随深浅色模式切换）
import { rng } from '../core/util.js';

const W = 320;
const svg = (h, body, title) =>
  `<figure class="diagram"><svg viewBox="0 0 ${W} ${h}" role="img" aria-label="${title}">${body}</svg><figcaption>${title}</figcaption></figure>`;
const txt = (x, y, s, cls = '', anchor = 'middle') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${s}</text>`;
const arrowDef = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="fill-ink"/></marker>
<marker id="ahp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="fill-pri"/></marker>
<marker id="ahw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="fill-warm"/></marker></defs>`;

export function flowSVG() {
  const lines = [
    ['浮法平板玻璃', ['配料', '熔化', '锡槽', '退火', '切割']],
    ['深加工（钢化）', ['切裁', '磨边', '清洗', '钢化']],
    ['日用玻璃瓶罐', ['料道', '供料', '制瓶', '退火', '检验']],
  ];
  const w = 52;
  const body = lines
    .map(([title, arr], r) => {
      const y = 20 + r * 50;
      return (
        txt(4, y - 6, title, 't-cap', 'start') +
        arr
          .map((s, i) => {
            const x = 4 + i * (w + 12);
            const arrow = i < arr.length - 1 ? `<line x1="${x + w + 1}" y1="${y + 12}" x2="${x + w + 10}" y2="${y + 12}" class="ln" marker-end="url(#ah)"/>` : '';
            return `<rect x="${x}" y="${y}" width="${w}" height="24" rx="12" class="chip-r"/>${txt(x + w / 2, y + 16, s, 't-sm')}${arrow}`;
          })
          .join('')
      );
    })
    .join('');
  return svg(150, arrowDef + body, '三条产线的工艺流程');
}

export function compositionSVG() {
  const data = [
    ['SiO₂', 72.5],
    ['Na₂O', 13.5],
    ['CaO', 8.6],
    ['MgO', 4.0],
    ['Al₂O₃', 1.0],
    ['其他', 0.4],
  ];
  const max = 75;
  const rows = data
    .map(([k, v], i) => {
      const y = 10 + i * 22;
      const w = (v / max) * 220;
      return `${txt(44, y + 11, k, 't-sm', 'end')}<rect x="52" y="${y}" width="${Math.max(2, w)}" height="14" rx="4" class="bar" style="opacity:${1 - i * 0.12}"/>${txt(58 + w, y + 11, v.toFixed(1) + '%', 't-num', 'start')}`;
    })
    .join('');
  return svg(144, rows, '浮法玻璃典型氧化物组成（质量分数）');
}

/** 晶体（石英）与玻璃（无规网络）对比 */
export function networkSVG() {
  const r = rng(42);
  let body = '';
  // 左：规则晶格
  const pts = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) pts.push([18 + j * 24 + (i % 2) * 12, 26 + i * 22]);
  pts.forEach(([x, y]) => {
    pts.forEach(([x2, y2]) => {
      const d = Math.hypot(x2 - x, y2 - y);
      if (d > 1 && d < 27 && x2 >= x) body += `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" class="bond"/><circle cx="${(x + x2) / 2}" cy="${(y + y2) / 2}" r="2.6" class="o"/>`;
    });
  });
  pts.forEach(([x, y]) => (body += `<circle cx="${x}" cy="${y}" r="4.2" class="si"/>`));
  // 右：无规网络 + 网络外体 Na⁺
  const q = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) q.push([182 + j * 25 + (r() - 0.5) * 14, 26 + i * 22 + (r() - 0.5) * 12]);
  const used = new Set();
  q.forEach(([x, y], a) => {
    q.forEach(([x2, y2], b) => {
      const d = Math.hypot(x2 - x, y2 - y);
      if (b > a && d < 31 && r() > 0.22) {
        used.add(a);
        body += `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" class="bond"/><circle cx="${(x + x2) / 2}" cy="${(y + y2) / 2}" r="2.6" class="o"/>`;
      }
    });
  });
  q.forEach(([x, y]) => (body += `<circle cx="${x}" cy="${y}" r="4.2" class="si"/>`));
  for (let i = 0; i < 6; i++) body += `<circle cx="${190 + r() * 110}" cy="${30 + r() * 60}" r="3.6" class="na"/>`;
  body += txt(78, 118, '晶体：长程有序', 't-sm') + txt(240, 118, '玻璃：短程有序、长程无序', 't-sm');
  body += `<circle cx="20" cy="136" r="4" class="si"/>${txt(28, 140, 'Si', 't-xs', 'start')}<circle cx="56" cy="136" r="2.6" class="o"/>${txt(63, 140, 'O', 't-xs', 'start')}<circle cx="90" cy="136" r="3.6" class="na"/>${txt(98, 140, 'Na⁺（网络外体，打断 Si–O 键）', 't-xs', 'start')}`;
  return svg(148, body, 'SiO₂ 晶体与钠钙玻璃的结构对比（二维示意）');
}

export function floatSVG() {
  const body =
    arrowDef +
    `<rect x="10" y="92" width="300" height="34" class="tin"/>` +
    txt(160, 114, '熔融锡液  ρ ≈ 6.5 g/cm³', 't-sm') +
    `<path d="M70 92 C 72 74, 86 70, 110 70 L 210 70 C 234 70, 248 74, 250 92 C 248 98, 234 100, 210 100 L 110 100 C 86 100, 72 98, 70 92 Z" class="hotglass"/>` +
    txt(160, 88, '玻璃液  ρ ≈ 2.5 g/cm³', 't-sm') +
    `<line x1="272" y1="70" x2="272" y2="100" class="ln" marker-start="url(#ah)" marker-end="url(#ah)"/>` +
    txt(280, 89, '≈ 6 mm', 't-num', 'start') +
    `<line x1="160" y1="20" x2="160" y2="56" class="ln-warm" marker-end="url(#ahw)"/>` +
    txt(166, 34, '重力：使玻璃摊开、变薄', 't-xs', 'start') +
    `<line x1="64" y1="62" x2="30" y2="62" class="ln-pri" marker-start="url(#ahp)"/>` +
    `<line x1="256" y1="62" x2="290" y2="62" class="ln-pri" marker-start="url(#ahp)"/>` +
    txt(20, 52, '表面张力', 't-xs', 'start') +
    txt(300, 52, '表面张力', 't-xs', 'end') +
    txt(160, 142, '两者平衡时达到"平衡厚度"；上表面火抛光，下表面贴合锡面，都极其平整', 't-xs');
  return svg(150, body, '锡液上玻璃液的受力与平衡厚度（截面示意，未按比例）');
}

export function lehrSVG() {
  const x0 = 40, x1 = 306, y0 = 16, y1 = 116;
  const X = (u) => x0 + (x1 - x0) * u;
  const Y = (T) => y1 - ((T - 0) / 650) * (y1 - y0);
  const pts = [[0, 600], [0.12, 560], [0.3, 520], [0.42, 480], [0.6, 380], [0.75, 200], [1, 70]];
  const path = pts.map(([u, T], i) => `${i ? 'L' : 'M'}${X(u).toFixed(1)},${Y(T).toFixed(1)}`).join(' ');
  const zones = [['A', 0, 0.25], ['B', 0.25, 0.47], ['C', 0.47, 0.64], ['D', 0.64, 0.8], ['F', 0.8, 1]];
  let body = zones.map(([z, a, b], i) => `<rect x="${X(a)}" y="${y0}" width="${X(b) - X(a)}" height="${y1 - y0}" class="${i % 2 ? 'zone2' : 'zone'}"/>${txt((X(a) + X(b)) / 2, y1 + 12, z + ' 区', 't-xs')}`).join('');
  body += `<line x1="${x0}" y1="${Y(550)}" x2="${x1}" y2="${Y(550)}" class="dash-warm"/>${txt(x1 - 2, Y(550) - 4, '退火点 ≈ 550°C', 't-xs warm', 'end')}`;
  body += `<line x1="${x0}" y1="${Y(510)}" x2="${x1}" y2="${Y(510)}" class="dash-pri"/>${txt(x1 - 2, Y(510) + 11, '应变点 ≈ 510°C', 't-xs pri', 'end')}`;
  body += `<path d="${path}" class="curve"/>`;
  [0, 200, 400, 600].forEach((T) => (body += `${txt(x0 - 6, Y(T) + 3, T, 't-num', 'end')}<line x1="${x0}" y1="${Y(T)}" x2="${x0 + 3}" y2="${Y(T)}" class="ln"/>`));
  body += txt(12, 12, '°C', 't-xs', 'start');
  return svg(136, body, '退火窑沿程温度：跨越退火点与应变点时冷却最慢');
}

export function cutSVG() {
  const body =
    arrowDef +
    `<rect x="20" y="30" width="230" height="90" class="plate"/>` +
    txt(135, 24, '移动中的玻璃带', 't-xs') +
    `<line x1="40" y1="80" x2="100" y2="80" class="ln-warm" marker-end="url(#ahw)"/>` +
    txt(70, 74, 'v 带', 't-xs warm') +
    `<line x1="150" y1="118" x2="196" y2="34" class="dash-pri"/>` +
    txt(205, 46, '横切桥', 't-xs', 'start') +
    `<line x1="150" y1="118" x2="190" y2="44" class="ln-ink" marker-end="url(#ah)"/>` +
    txt(186, 100, 'v 刀（沿桥）', 't-xs', 'start') +
    `<line x1="150" y1="118" x2="150" y2="44" class="ln-pri" marker-end="url(#ahp)"/>` +
    `<line x1="150" y1="44" x2="190" y2="44" class="ln-warm" marker-end="url(#ahw)" style="opacity:.6"/>` +
    txt(146, 70, '相对玻璃：', 't-xs pri', 'end') +
    txt(146, 82, '垂直横切', 't-xs pri', 'end') +
    `<line x1="150" y1="30" x2="150" y2="120" class="score"/>` +
    txt(160, 140, 'v 刀 = v 带 + v 相对 ⇒ 切痕与板边垂直', 't-xs');
  return svg(148, body, '斜置横切桥的速度合成');
}

export function edgeSVG() {
  const shapes = [
    ['原切口', 'M0,0 L40,0 L40,16 L0,16'],
    ['粗磨', 'M0,0 L38,0 Q40,0 40,4 L40,12 Q40,16 38,16 L0,16'],
    ['精磨抛光', 'M0,0 L36,0 Q40,0 40,5 L40,11 Q40,16 36,16 L0,16'],
    ['倒安全角', 'M0,0 L35,0 L40,5 L40,11 L35,16 L0,16'],
  ];
  const body =
    arrowDef +
    shapes
      .map(([n, d], i) => {
        const x = 12 + i * 78;
        return `<g transform="translate(${x},34)"><path d="${d}" class="edge"/>${i === 0 ? '<path d="M40,3 l-5,2 l4,2 l-6,3 l5,2" class="crack"/>' : ''}</g>${txt(x + 24, 72, n, 't-sm')}${i < 3 ? `<line x1="${x + 52}" y1="42" x2="${x + 70}" y2="42" class="ln" marker-end="url(#ah)"/>` : ''}`;
      })
      .join('') +
    txt(160, 96, '切口处的微裂纹（左）是钢化破损的起点', 't-xs');
  return svg(104, body, '玻璃边部截面的加工过程');
}

export function stressSVG() {
  const cx = 40, cw = 240, top = 20, bot = 120;
  const X = (s) => cx + cw / 2 + s * 1.05; // s: MPa，负为压应力
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const z = i / 40;
    const u = 2 * z - 1;
    const s = -95 + 142.5 * (1 - u * u);
    pts.push(`${i ? 'L' : 'M'}${X(s).toFixed(1)},${(top + (bot - top) * z).toFixed(1)}`);
  }
  const body =
    `<rect x="${cx}" y="${top}" width="${cw}" height="${bot - top}" class="zone"/>` +
    `<line x1="${X(0)}" y1="${top - 6}" x2="${X(0)}" y2="${bot + 6}" class="ln"/>` +
    `<path d="${pts.join(' ')}" class="curve"/>` +
    `<path d="${pts.join(' ')} L${X(0)},${bot} L${X(0)},${top} Z" class="area"/>` +
    txt(X(-95) - 4, top + 12, '表面压应力 −95 MPa', 't-xs pri', 'start') +
    txt(X(-95) - 4, bot - 4, '表面压应力', 't-xs pri', 'start') +
    txt(X(47) + 6, (top + bot) / 2 + 4, '中心张应力 +47 MPa', 't-xs warm', 'start') +
    txt(cx - 4, top + 4, '上表面', 't-xs', 'end') +
    txt(cx - 4, bot, '下表面', 't-xs', 'end') +
    txt(160, bot + 22, '沿厚度近似抛物线分布；压应力层约占板厚 1/5', 't-xs');
  return svg(150, body, '钢化玻璃沿厚度方向的残余应力');
}

export function isSVG() {
  const step = (x, label, inner) => `<g transform="translate(${x},14)">${inner}</g>${txt(x + 22, 112, label, 't-xs')}`;
  const mold = (h = 70) => `<rect x="4" y="16" width="36" height="${h}" rx="3" class="mold"/>`;
  const body =
    step(6, '料滴', `<ellipse cx="22" cy="42" rx="9" ry="20" class="hotglass"/>`) +
    step(66, '扑气', mold() + `<rect x="14" y="20" width="16" height="44" rx="8" class="hotglass"/><rect x="12" y="74" width="20" height="10" class="hotglass"/><line x1="22" y1="2" x2="22" y2="14" class="ln-pri" marker-end="url(#ahp)"/>`) +
    step(126, '倒吹 → 初型', mold() + `<path d="M14,22 h16 v46 h-3 v-40 h-10 v40 h-3 z" class="hotglass"/><rect x="12" y="74" width="20" height="10" class="hotglass"/><line x1="22" y1="100" x2="22" y2="76" class="ln-pri" marker-end="url(#ahp)"/>`) +
    step(186, '翻转 180°', `<path d="M10,30 A 16 16 0 1 1 34 30" class="ln" marker-end="url(#ah)" fill="none"/><path d="M15,48 h14 v34 h-14z" class="hotglass"/><rect x="13" y="42" width="18" height="8" class="hotglass"/>`) +
    step(246, '正吹 → 成瓶', mold(76) + `<path d="M17,20 h10 v8 q12,6 12,18 v34 h-34 v-34 q0,-12 12,-18 z" class="hotglass"/><line x1="22" y1="0" x2="22" y2="16" class="ln-pri" marker-end="url(#ahp)"/>`);
  return svg(122, arrowDef + body, '吹-吹法成型步骤（箭头为压缩空气）');
}

export function bottleLehrSVG() {
  const x0 = 34, x1 = 306, y0 = 14, y1 = 108;
  const X = (u) => x0 + (x1 - x0) * u;
  const Y = (T) => y1 - (T / 650) * (y1 - y0);
  const pts = [[0, 470], [0.12, 560], [0.3, 560], [0.55, 480], [0.8, 200], [1, 50]];
  const path = pts.map(([u, T], i) => `${i ? 'L' : 'M'}${X(u).toFixed(1)},${Y(T).toFixed(1)}`).join(' ');
  let body = `<rect x="${X(0)}" y="${y0}" width="${X(0.12) - X(0)}" height="${y1 - y0}" class="zone"/><rect x="${X(0.12)}" y="${y0}" width="${X(0.3) - X(0.12)}" height="${y1 - y0}" class="zone2"/><rect x="${X(0.3)}" y="${y0}" width="${X(0.55) - X(0.3)}" height="${y1 - y0}" class="zone"/><rect x="${X(0.55)}" y="${y0}" width="${X(1) - X(0.55)}" height="${y1 - y0}" class="zone2"/>`;
  body += txt((X(0) + X(0.12)) / 2, y1 + 12, '回热', 't-xs') + txt((X(0.12) + X(0.3)) / 2, y1 + 12, '保温', 't-xs') + txt((X(0.3) + X(0.55)) / 2, y1 + 12, '慢冷', 't-xs') + txt((X(0.55) + X(1)) / 2, y1 + 12, '快冷', 't-xs');
  body += `<path d="${path}" class="curve"/>`;
  [0, 200, 400, 600].forEach((T) => (body += txt(x0 - 5, Y(T) + 3, T, 't-num', 'end')));
  return svg(126, body, '瓶罐退火制度（温度–时间）');
}
