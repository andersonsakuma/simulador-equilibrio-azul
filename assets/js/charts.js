/* Gráficos SVG mínimos do simulador, da página inicial e do dashboard.
   Cores entram como nomes de variáveis CSS (ex.: 'var(--s1)'). */
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const loc = () => (typeof window !== 'undefined' && window.I18N ? window.I18N.loc() : 'pt-BR');
  const fmt = (v, d = 2) => (Math.abs(v) >= 1000 ? v.toLocaleString(loc(), { maximumFractionDigits: 0 })
    : v.toLocaleString(loc(), { minimumFractionDigits: 0, maximumFractionDigits: d }));
  const niceTicks = (min, max, n = 5) => {
    const span = max - min || 1;
    const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag;
    const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const t = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) t.push(+v.toFixed(10));
    return t;
  };
  // ticks que cobrem [0, max] inteiro
  const coverTicks = (max, n = 4) => {
    const t = niceTicks(0, max, n);
    const step = t.length > 1 ? t[1] - t[0] : (max || 1);
    while (t[t.length - 1] < max - 1e-9) t.push(+(t[t.length - 1] + step).toFixed(10));
    return t;
  };
  function tooltipLayer(host) {
    if (!host) return null;
    let tt = host.querySelector('.ch-tt');
    if (!tt) { tt = document.createElement('div'); tt.className = 'ch-tt'; tt.hidden = true; host.appendChild(tt); }
    return {
      show(html, x, y) {
        tt.innerHTML = html; tt.hidden = false;
        const hw = host.clientWidth, w = tt.offsetWidth;
        tt.style.left = Math.min(Math.max(x + 12, 0), hw - w - 4) + 'px';
        tt.style.top = Math.max(y - tt.offsetHeight - 10, 0) + 'px';
      },
      hide() { tt.hidden = true; }
    };
  }
  function legend(host, series) {
    if (series.length < 2) return;
    const lg = document.createElement('div'); lg.className = 'ch-legend';
    series.forEach(s => {
      const it = document.createElement('span'); it.className = 'ch-lg';
      const sw = document.createElement('i'); sw.style.background = s.color;
      if (s.dash) sw.className = 'dash';
      it.appendChild(sw); it.appendChild(document.createTextNode(s.name)); lg.appendChild(it);
    });
    host.appendChild(lg);
  }
  const relPos = (host, ev) => { const r = host.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };

  /* Barras horizontais (empilhadas ou simples). rows: [{label, values:[]}], series: [{name,color}] */
  function hbar(host, { rows, series, W = 640, barH = 16, gap = 10, labelW = 190, valueFmt = v => fmt(v, 0), totalFmt, interactive = false, total = true }) {
    totalFmt = totalFmt || valueFmt;
    host.innerHTML = '';
    legend(host, series);
    const top = 6, H = top + rows.length * (barH + gap) + 22;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ch', role: 'img' }, host);
    const max = Math.max(...rows.map(r => r.values.reduce((a, b) => a + b, 0))) || 1;
    const ticks = coverTicks(max, 4); const xmax = ticks[ticks.length - 1];
    const x0 = labelW, x1 = W - 40, sx = v => x0 + (x1 - x0) * v / xmax;
    ticks.forEach(t => {
      el('line', { x1: sx(t), x2: sx(t), y1: top - 2, y2: H - 20, class: 'ch-grid' }, svg);
      const tx = el('text', { x: sx(t), y: H - 6, class: 'ch-tick', 'text-anchor': 'middle' }, svg); tx.textContent = fmt(t, 0);
    });
    const tip = interactive ? tooltipLayer(host) : null;
    rows.forEach((r, i) => {
      const y = top + i * (barH + gap);
      const lb = el('text', { x: x0 - 8, y: y + barH / 2 + 4, class: 'ch-label', 'text-anchor': 'end' }, svg); lb.textContent = r.label;
      let acc = 0; const segs = r.values.map((v, j) => ({ v, j })).filter(s => s.v > 0);
      segs.forEach((s, k) => {
        const xa = sx(acc), xb = sx(acc + s.v); acc += s.v;
        const wv = Math.max(xb - xa - (k < segs.length - 1 ? 2 : 0), 1);
        const last = k === segs.length - 1;
        const rect = last
          ? el('path', { d: `M${xa},${y} h${Math.max(wv - 4, 0)} a4,4 0 0 1 4,4 v${barH - 8} a4,4 0 0 1 -4,4 h${-Math.max(wv - 4, 0)} z`, style: `fill:${series[s.j].color}` }, svg)
          : el('rect', { x: xa, y, width: wv, height: barH, style: `fill:${series[s.j].color}` }, svg);
        if (tip) {
          rect.classList.add('hit');
          rect.addEventListener('mousemove', ev => { const [px, py] = relPos(host, ev); tip.show(`<b>${r.label}</b><br>${series[s.j].name}: ${valueFmt(s.v)}`, px, py); });
          rect.addEventListener('mouseleave', () => tip.hide());
        }
      });
      if (total) { const tv = el('text', { x: sx(acc) + 6, y: y + barH / 2 + 4, class: 'ch-val' }, svg); tv.textContent = totalFmt(acc); }
    });
    return svg;
  }

  /* Colunas simples. */
  function columns(host, { labels, values, color = 'var(--s1)', W = 640, H = 220, valueFmt = v => fmt(v, 0), interactive = false, name = '' }) {
    host.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ch', role: 'img' }, host);
    const L = 34, R = 10, T = 16, B = 26;
    const max = Math.max(...values) || 1; const ticks = coverTicks(max, 4); const ymax = ticks[ticks.length - 1];
    const sy = v => H - B - (H - B - T) * v / ymax;
    ticks.forEach(t => {
      el('line', { x1: L, x2: W - R, y1: sy(t), y2: sy(t), class: 'ch-grid' }, svg);
      const tx = el('text', { x: L - 6, y: sy(t) + 4, class: 'ch-tick', 'text-anchor': 'end' }, svg); tx.textContent = fmt(t, 0);
    });
    const n = values.length, slot = (W - L - R) / n, bw = Math.min(slot * 0.56, 46);
    const tip = interactive ? tooltipLayer(host) : null;
    values.forEach((v, i) => {
      const cx = L + slot * (i + 0.5), x = cx - bw / 2, y = sy(v), h = H - B - y;
      const p = el('path', { d: h > 4 ? `M${x},${H - B} v${-(h - 4)} a4,4 0 0 1 4,-4 h${bw - 8} a4,4 0 0 1 4,4 v${h - 4} z` : `M${x},${H - B} h${bw} v${-h} h${-bw} z`, style: `fill:${color}` }, svg);
      const lb = el('text', { x: cx, y: H - 8, class: 'ch-tick', 'text-anchor': 'middle' }, svg); lb.textContent = labels[i];
      const tv = el('text', { x: cx, y: y - 5, class: 'ch-val', 'text-anchor': 'middle' }, svg); tv.textContent = valueFmt(v);
      if (tip) {
        p.classList.add('hit');
        p.addEventListener('mousemove', ev => { const [px, py] = relPos(host, ev); tip.show(`<b>${labels[i]}</b><br>${name}${name ? ': ' : ''}${valueFmt(v)}`, px, py); });
        p.addEventListener('mouseleave', () => tip.hide());
      }
    });
    return svg;
  }

  /* Linhas. series: [{name,color,x:[],y:[],dash}], marks: [{x,y,label,color}], vlines/hlines: [{v,label}] */
  function lines(host, { series, W = 640, H = 260, xLabel = '', xName = '', yLabel = '', xDomain, yDomain, marks = [], vlines = [], hlines = [], interactive = false, xFmt = v => fmt(v, 2), yFmt = v => fmt(v, 3), zeroLine = false }) {
    host.innerHTML = '';
    legend(host, series);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ch', role: 'img' }, host);
    const L = 52, R = 14, T = 12, B = 40;
    const allx = series.flatMap(s => s.x), ally = series.flatMap(s => s.y);
    let [xa, xb] = xDomain || [Math.min(...allx), Math.max(...allx)];
    let [ya, yb] = yDomain || [Math.min(0, ...ally), Math.max(...ally)];
    if (!yDomain) { const pad = (yb - ya) * 0.06 || 1; yb += pad; if (ya < 0) ya -= pad; }
    const yt = niceTicks(ya, yb, 5); if (!yDomain) { ya = Math.min(ya, yt[0]); yb = Math.max(yb, yt[yt.length - 1]); }
    const xt = niceTicks(xa, xb, 6);
    const sx = v => L + (W - L - R) * (v - xa) / (xb - xa || 1);
    const sy = v => H - B - (H - B - T) * (v - ya) / (yb - ya || 1);
    yt.filter(t => t >= ya - 1e-9 && t <= yb + 1e-9).forEach(t => {
      el('line', { x1: L, x2: W - R, y1: sy(t), y2: sy(t), class: Math.abs(t) < 1e-12 && zeroLine ? 'ch-zero' : 'ch-grid' }, svg);
      const tx = el('text', { x: L - 6, y: sy(t) + 4, class: 'ch-tick', 'text-anchor': 'end' }, svg); tx.textContent = yFmt(t);
    });
    xt.filter(t => t >= xa - 1e-9 && t <= xb + 1e-9).forEach(t => {
      const tx = el('text', { x: sx(t), y: H - B + 16, class: 'ch-tick', 'text-anchor': 'middle' }, svg); tx.textContent = xFmt(t);
    });
    el('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'ch-axis' }, svg);
    if (xLabel) { const t = el('text', { x: (L + W - R) / 2, y: H - 6, class: 'ch-axtitle', 'text-anchor': 'middle' }, svg); t.textContent = xLabel; }
    if (yLabel) { const t = el('text', { x: 12, y: (T + H - B) / 2, class: 'ch-axtitle', 'text-anchor': 'middle', transform: `rotate(-90 12 ${(T + H - B) / 2})` }, svg); t.textContent = yLabel; }
    vlines.forEach(v => {
      el('line', { x1: sx(v.v), x2: sx(v.v), y1: T, y2: H - B, class: 'ch-ref' }, svg);
      if (v.label) { const t = el('text', { x: sx(v.v) + 4, y: T + 10, class: 'ch-reflabel' }, svg); t.textContent = v.label; }
    });
    hlines.forEach(v => {
      el('line', { x1: L, x2: W - R, y1: sy(v.v), y2: sy(v.v), class: 'ch-ref' }, svg);
      if (v.label) { const t = el('text', { x: W - R - 4, y: sy(v.v) - 5, class: 'ch-reflabel', 'text-anchor': 'end' }, svg); t.textContent = v.label; }
    });
    series.forEach(s => {
      const d = s.x.map((xv, i) => `${i ? 'L' : 'M'}${sx(xv).toFixed(2)},${sy(s.y[i]).toFixed(2)}`).join('');
      el('path', { d, class: 'ch-line' + (s.dash ? ' dash' : ''), style: `stroke:${s.color}` }, svg);
    });
    marks.forEach(m => {
      el('circle', { cx: sx(m.x), cy: sy(m.y), r: 5, class: 'ch-mark', style: `fill:${m.color || 'var(--ink)'}` }, svg);
      if (m.label) { const t = el('text', { x: sx(m.x) + (m.dx ?? 8), y: sy(m.y) + (m.dy ?? -8), class: 'ch-marklabel', 'text-anchor': m.anchor || 'start' }, svg); t.textContent = m.label; }
    });
    if (interactive) {
      const tip = tooltipLayer(host);
      const cross = el('line', { x1: 0, x2: 0, y1: T, y2: H - B, class: 'ch-cross', visibility: 'hidden' }, svg);
      const dots = series.map(s => el('circle', { r: 4, class: 'ch-dot', style: `fill:${s.color}`, visibility: 'hidden' }, svg));
      const hit = el('rect', { x: L, y: T, width: W - L - R, height: H - B - T, class: 'ch-hitarea' }, svg);
      hit.addEventListener('mousemove', ev => {
        const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        const xv = xa + (p.x - L) / (W - L - R) * (xb - xa);
        const s0 = series[0]; let bi = 0, bd = Infinity;
        s0.x.forEach((v, i) => { const dd = Math.abs(v - xv); if (dd < bd) { bd = dd; bi = i; } });
        cross.setAttribute('x1', sx(s0.x[bi])); cross.setAttribute('x2', sx(s0.x[bi])); cross.setAttribute('visibility', 'visible');
        let html = `<b>${xName || xLabel || 'x'} = ${xFmt(s0.x[bi])}</b>`;
        series.forEach((s, j) => {
          const yv = s.y[bi]; if (yv === undefined) return;
          dots[j].setAttribute('cx', sx(s.x[bi])); dots[j].setAttribute('cy', sy(yv)); dots[j].setAttribute('visibility', 'visible');
          html += `<br><i class="lk" style="background:${s.color}"></i><b>${yFmt(yv)}</b> ${s.name}`;
        });
        const [px, py] = relPos(host, ev); tip.show(html, px, py);
      });
      hit.addEventListener('mouseleave', () => { tip.hide(); cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); });
    }
    return svg;
  }

  /* Dispersão. series: [{name,color,pts:[{x,y,label}]}]; tip(pt, s) devolve o HTML do balão; onClick(pt). */
  function scatter(host, { series, W = 640, H = 300, xLabel = '', yLabel = '', xFmt = v => fmt(v, 0), yFmt = v => fmt(v, 0), tip, onClick }) {
    host.innerHTML = '';
    legend(host, series);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ch', role: 'img' }, host);
    const L = 56, R = 16, T = 12, B = 42;
    const all = series.flatMap(s => s.pts);
    const xt = coverTicks(Math.max(...all.map(p => p.x), 0) || 1, 5), yt = coverTicks(Math.max(...all.map(p => p.y), 0) || 1, 4);
    const xb = xt[xt.length - 1], yb = yt[yt.length - 1];
    const sx = v => L + (W - L - R) * v / xb, sy = v => H - B - (H - B - T) * v / yb;
    yt.forEach(v => {
      el('line', { x1: L, x2: W - R, y1: sy(v), y2: sy(v), class: v === 0 ? 'ch-axis' : 'ch-grid' }, svg);
      el('text', { x: L - 6, y: sy(v) + 4, class: 'ch-tick', 'text-anchor': 'end' }, svg).textContent = yFmt(v);
    });
    xt.forEach(v => { el('text', { x: sx(v), y: H - B + 16, class: 'ch-tick', 'text-anchor': 'middle' }, svg).textContent = xFmt(v); });
    if (xLabel) el('text', { x: (L + W - R) / 2, y: H - 6, class: 'ch-axtitle', 'text-anchor': 'middle' }, svg).textContent = xLabel;
    if (yLabel) el('text', { x: 12, y: (T + H - B) / 2, class: 'ch-axtitle', 'text-anchor': 'middle', transform: `rotate(-90 12 ${(T + H - B) / 2})` }, svg).textContent = yLabel;
    const pts = [];
    series.forEach(s => s.pts.forEach(p => {
      const c = el('circle', { cx: sx(p.x), cy: sy(p.y), r: 4.5, class: 'ch-mark', style: `fill:${s.color}` }, svg);
      pts.push({ p, s, c, X: sx(p.x), Y: sy(p.y) });
    }));
    const tt = tooltipLayer(host);
    const ring = el('circle', { r: 8, class: 'ch-hover', visibility: 'hidden' }, svg);
    const hit = el('rect', { x: L, y: T, width: W - L - R, height: H - B - T, class: 'ch-hitarea' }, svg);
    let atual = null;
    const perto = ev => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      let b = null, bd = 24 * 24 * (W / Math.max(1, host.clientWidth)) ** 2;
      pts.forEach(o => { const d = (o.X - q.x) ** 2 + (o.Y - q.y) ** 2; if (d < bd) { bd = d; b = o; } });
      return b;
    };
    hit.addEventListener('mousemove', ev => {
      atual = perto(ev);
      if (!atual) { tt.hide(); ring.setAttribute('visibility', 'hidden'); hit.style.cursor = 'crosshair'; return; }
      ring.setAttribute('cx', atual.X); ring.setAttribute('cy', atual.Y); ring.setAttribute('visibility', 'visible');
      hit.style.cursor = onClick ? 'pointer' : 'crosshair';
      const [px, py] = relPos(host, ev); tt.show(tip ? tip(atual.p, atual.s) : `<b>${atual.p.label}</b>`, px, py);
    });
    hit.addEventListener('mouseleave', () => { tt.hide(); ring.setAttribute('visibility', 'hidden'); });
    if (onClick) hit.addEventListener('click', ev => { const o = perto(ev); if (o) onClick(o.p); });
    return svg;
  }

  /* Barras horizontais divergentes a partir do zero. rows: [{label, v}] */
  function divbar(host, { rows, W = 640, barH = 16, gap = 10, labelW = 150, pos, neg, valueFmt = v => fmt(v, 0), interactive = true }) {
    host.innerHTML = '';
    legend(host, [{ name: pos.name, color: pos.color }, { name: neg.name, color: neg.color }]);
    const top = 6, H = top + rows.length * (barH + gap) + 22;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ch', role: 'img' }, host);
    const mx = Math.max(...rows.map(r => Math.max(0, r.v)), 0), mn = Math.min(...rows.map(r => Math.min(0, r.v)), 0);
    const span = (mx - mn) || 1, x0 = labelW + (mn < 0 ? 58 : 0), x1 = W - 58;
    const sx = v => x0 + (x1 - x0) * (v - mn) / span, z = sx(0);
    niceTicks(mn, mx || 1, 4).filter(v => v >= mn - 1e-9 && v <= mx + 1e-9).forEach(v => {
      el('line', { x1: sx(v), x2: sx(v), y1: top - 2, y2: H - 20, class: Math.abs(v) < 1e-12 ? 'ch-axis' : 'ch-grid' }, svg);
      el('text', { x: sx(v), y: H - 6, class: 'ch-tick', 'text-anchor': 'middle' }, svg).textContent = fmt(v, 0);
    });
    const tt = interactive ? tooltipLayer(host) : null;
    rows.forEach((r, i) => {
      const y = top + i * (barH + gap), w = Math.abs(sx(r.v) - z), c = r.v >= 0 ? pos.color : neg.color;
      el('text', { x: labelW - 8, y: y + barH / 2 + 4, class: 'ch-label', 'text-anchor': 'end' }, svg).textContent = r.label;
      const rr = Math.min(4, w / 2), d = r.v >= 0
        ? `M${z},${y} h${w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} v${barH - 2 * rr} a${rr},${rr} 0 0 1 ${-rr},${rr} h${-(w - rr)} z`
        : `M${z},${y} h${-(w - rr)} a${rr},${rr} 0 0 0 ${-rr},${rr} v${barH - 2 * rr} a${rr},${rr} 0 0 0 ${rr},${rr} h${w - rr} z`;
      const p = el('path', { d, style: `fill:${c}` }, svg);
      const tv = el('text', { x: r.v >= 0 ? z + w + 6 : z - w - 6, y: y + barH / 2 + 4, class: 'ch-val', 'text-anchor': r.v >= 0 ? 'start' : 'end' }, svg);
      tv.textContent = valueFmt(r.v);
      if (tt) {
        const hb = el('rect', { x: x0 - 4, y: y - gap / 2, width: x1 - x0 + 60, height: barH + gap, class: 'ch-hitbar' }, svg);
        hb.addEventListener('mousemove', ev => { const [px, py] = relPos(host, ev); tt.show(`<b>${valueFmt(r.v)}</b><br>${r.label}`, px, py); p.classList.add('on'); });
        hb.addEventListener('mouseleave', () => { tt.hide(); p.classList.remove('on'); });
      }
    });
    return svg;
  }

  /* Curva T*(γ) de um agrupamento (simulador e dashboard). */
  function curvaGamma(host, r, g, u) {
    const I = window.I18N, t = I.t, br = I.num;
    const W = Math.max(300, Math.round(host.clientWidth || 640));
    const mx0 = Math.max(...r.curva.map(c => c.T), r.F || 0);
    const [k, lab] = I.emMil(u) ? [1, u] : mx0 >= 1e6 ? [1e6, t('u.mi.longo', { u })] : mx0 >= 1e4 ? [1e3, t('u.mil.longo', { u })] : [1, u];
    const xs = r.curva.map(c => c.g), ys = r.curva.map(c => c.T / k), Fk = (r.F || 0) / k;
    const i = Math.min(19, Math.floor(g * 20)), a = r.curva[i], b = r.curva[i + 1] || a;
    const yg = a.T + (b.T - a.T) * Math.max(0, Math.min(1, (g - a.g) / 0.05));
    const marks = [{ x: g, y: yg / k, label: `γ = ${br(g, 2)}: ${I.money(yg, u)}`, color: 'var(--s1)', anchor: g > 0.6 ? 'end' : 'start', dx: g > 0.6 ? -8 : 8 }];
    if (r.gStar != null && r.gStar > 0) marks.push({ x: r.gStar, y: 0, label: `γ* = ${br(r.gStar, 2)}`, color: 'var(--s3)', dy: -10 });
    const ymax = Math.max(...ys, Fk) * 1.15 || 1;
    return lines(host, { series: [{ name: 'T*', color: 'var(--s1)', x: xs, y: ys }], W, H: 250, xLabel: t('ch.gamma.x'), xName: 'γ', yLabel: 'T* (' + lab + ')',
      xDomain: [0, 1], yDomain: [0, ymax], xFmt: v => br(v, 2), yFmt: v => br(v, ymax < 5 ? 2 : ymax < 50 ? 1 : 0), interactive: true,
      hlines: Fk > 0 && Fk < ymax ? [{ v: Fk, label: t('ch.F') }] : [], marks });
  }
  return { hbar, columns, lines, scatter, divbar, curvaGamma, fmt };
})();
if (typeof module !== 'undefined') module.exports = Charts;
