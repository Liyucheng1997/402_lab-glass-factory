import { GROUPS } from './data/stations.js';

const ICON = {
  play: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M7 5v14l12-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  moon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  prev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
};

const TOGGLES = [
  ['cutaway', '剖切视图', 'C'],
  ['stress', '应力光弹', 'S'],
  ['labels', '标签', 'L'],
  ['tour', '自动导览', 'T'],
];

export function createUI({ stations, sim, onSelect, onToggle }) {
  const $ = (s) => document.querySelector(s);
  const nav = $('#stations');
  const info = $('#info');
  const dock = $('#dock');
  let current = 0;

  // ---- 工位导航 ----
  nav.innerHTML = GROUPS.map(
    (g) => `<div class="nav-group"><div class="nav-title">${g.name}</div>${stations
      .map((s, i) => (s.group === g.id ? `<button class="nav-item" data-i="${i}"><span class="nav-no tabular">${s.no}</span><span class="nav-text"><span class="nav-name">${s.name}</span><span class="nav-sub">${s.short}</span></span></button>` : ''))
      .join('')}</div>`
  ).join('');
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('.nav-item');
    if (b) select(+b.dataset.i);
  });

  // ---- 讲解面板 ----
  function renderInfo(s, i) {
    info.innerHTML = `
      <div class="info-head">
        <div>
          <div class="info-kicker">${s.no === '0' ? 'OVERVIEW' : 'STEP ' + s.no}</div>
          <h2 class="info-title">${s.name}</h2>
          <div class="info-short">${s.short}</div>
        </div>
        <button class="close-x" id="info-close" aria-label="收起讲解">${ICON.close}</button>
      </div>
      <div class="info-body">
        <p class="lead">${s.lead}</p>
        <div class="params">${s.params.map(([k, v]) => `<div class="param"><div class="param-k">${k}</div><div class="param-v tabular">${v}</div></div>`).join('')}</div>
        ${s.diagram ? s.diagram() : ''}
        ${s.sections.map((sec) => `<section><h3>${sec.h}</h3>${sec.p.map((p) => `<p>${p}</p>`).join('')}</section>`).join('')}
      </div>
      <div class="info-foot">
        <button class="btn btn-sm" id="info-prev" ${i === 0 ? 'disabled' : ''}>${ICON.prev}上一步</button>
        <span class="muted tabular">${i + 1} / ${stations.length}</span>
        <button class="btn btn-sm btn-primary" id="info-next" ${i === stations.length - 1 ? 'disabled' : ''}>下一步${ICON.next}</button>
      </div>`;
    info.querySelector('.info-body').scrollTop = 0;
    $('#info-close').onclick = () => document.body.classList.toggle('info-collapsed');
    $('#info-prev').onclick = () => select(current - 1);
    $('#info-next').onclick = () => select(current + 1);
  }

  function select(i, fly = true) {
    if (typeof i === 'string') i = stations.findIndex((s) => s.id === i);
    i = Math.max(0, Math.min(stations.length - 1, i));
    current = i;
    const s = stations[i];
    nav.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', +b.dataset.i === i));
    nav.querySelector(`.nav-item[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    document.body.classList.remove('info-collapsed');
    renderInfo(s, i);
    if (fly) onSelect(s);
  }

  // ---- 控制栏 ----
  dock.innerHTML = `
    <button class="icon-btn play" id="play" aria-label="暂停/播放">${ICON.pause}</button>
    <div class="seg" id="speed">${[0.5, 1, 2, 4].map((v) => `<button data-v="${v}" class="${v === 1 ? 'active' : ''}">${v}×</button>`).join('')}</div>
    <span class="dock-sep"></span>
    ${TOGGLES.map(([k, n, key]) => `<button class="chip ${sim[k] ? 'active' : ''}" data-k="${k}" title="快捷键 ${key}">${n}</button>`).join('')}
    <span class="dock-sep"></span>
    <button class="icon-btn" id="home" aria-label="回到总览" title="回到总览（0）">${ICON.home}</button>
    <button class="icon-btn" id="night" aria-label="昼夜切换" title="昼夜切换（N）">${ICON.moon}</button>`;

  const setPaused = (p) => {
    sim.paused = p;
    $('#play').innerHTML = p ? ICON.play : ICON.pause;
  };
  $('#play').onclick = () => setPaused(!sim.paused);
  $('#speed').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    sim.speed = +b.dataset.v;
    $('#speed').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  });
  const toggle = (k, v = !sim[k]) => {
    sim[k] = v;
    dock.querySelector(`[data-k="${k}"]`)?.classList.toggle('active', v);
    onToggle(k);
  };
  dock.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b) toggle(b.dataset.k);
  });
  $('#home').onclick = () => select(0);
  $('#night').onclick = () => {
    sim.night = !sim.night;
    $('#night').innerHTML = sim.night ? ICON.sun : ICON.moon;
    onToggle('night');
  };

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (/^[0-9]$/.test(k)) select(+k);
    else if (k === ' ') {
      e.preventDefault();
      setPaused(!sim.paused);
    } else if (k === 'c') toggle('cutaway');
    else if (k === 's') toggle('stress');
    else if (k === 'l') toggle('labels');
    else if (k === 't') toggle('tour');
    else if (k === 'n') $('#night').click();
    else if (k === 'arrowright') select(current + 1);
    else if (k === 'arrowleft') select(current - 1);
  });

  select(0, false);
  return {
    select,
    next: () => select((current + 1) % stations.length),
    setTour: (v) => toggle('tour', v),
    setToggle: (k, v) => sim[k] !== v && toggle(k, v),
  };
}
