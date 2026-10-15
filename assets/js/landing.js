/* Página inicial: números da Bolsa Azul e demonstração passo a passo com o biossistema de Garuva (calculado pelo motor). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const EN = window.Engine, ST = window.Estado, I = window.I18N, t = I.t, br = I.num;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const IDS = ['G1', 'G2', 'G3', 'G4'];
  const st = { sel: IDS.slice(), g: 0, passo: 1 };
  let G, M, R, U;

  /* ------------------------------------------------------------ números do estudo */
  function kpis() {
    const k = (lb, v, ft) => `<div class="kpi"><span class="lb">${lb}</span><b>${v}</b><span class="ft">${ft}</span></div>`;
    const mi = v => I.money(v, 'USD', true);
    $('land-kpis').innerHTML = k(t('kpi.T'), mi(29.66e6), t('land.k1.ft', { v: mi(29.21e6), d: '+' + I.pct(0.0152, 1) }))
      + k(t('kpi.A') + ' 𝒜', mi(387e6), t('land.k2.ft'))
      + k(t('land.k3'), t('r.k.eq.v', { a: 93, b: 101 }), t('r.k.eq.ft'))
      + k(t('land.k4'), '+' + mi(22.0e6), t('land.k4.ft'))
      + k(t('land.k5'), br(3.78, 2), t('land.k5.ft'));
  }

  /* ------------------------------------------------------------ cálculo */
  function calcular() {
    G = ST.garuva(); U = G.moeda;
    M = ST.modelo({ modo: 'local', local: G });
    R = EN.avaliar(M, { gamma: st.g, sel: st.sel, universo: IDS, obrig: [], maxTam: 99, F: 35, mbar: 6, theta: 1, Z0: 2500, regen: true, top: 15 });
    // melhor subconjunto do agrupamento (quem dá v(N)) e f(R) de cada subconjunto
    const P = EN.preparar(M, IDS), Tb = EN.tabelas(P, st.g);
    const N = st.sel.reduce((m, id) => m | (1 << P.ids.indexOf(id)), 0);
    R.subs = [];
    for (let S = N; S; S = (S - 1) & N) R.subs.push({ ids: P.ids.filter((_, i) => (S >> i) & 1), f: Tb.f[S], S });
    R.subs.sort((a, b) => b.f - a.f);
    R.best = R.subs.length && R.subs[0].f > 0 ? R.subs[0] : null;
    render();
  }
  const mo = v => I.money(v, U);
  const lista = ids => (ids && ids.length ? ids.join(', ') : t('nenhum'));
  const nomeG = id => t('garuva.' + id);

  /* ------------------------------------------------------------ controles */
  function controles() {
    $('d-mods').innerHTML = IDS.map(id => `<label class="mchip"><input type="checkbox" value="${id}" ${st.sel.includes(id) ? 'checked' : ''}><span><b>${id}</b> ${esc(t('garuva.s.' + id))}</span></label>`).join('');
    $('d-gam').value = st.g; $('d-gam-v').textContent = br(st.g, 2);
  }
  $('d-mods').addEventListener('change', e => {
    const id = e.target.value; if (!id) return;
    st.sel = IDS.filter(x => (x === id ? e.target.checked : st.sel.includes(x)));
    calcular();
  });
  $('d-gam').addEventListener('input', e => { st.g = +e.target.value; $('d-gam-v').textContent = br(st.g, 2); calcular(); });
  $('d-reset').addEventListener('click', () => { st.sel = IDS.slice(); st.g = 0; controles(); calcular(); });

  /* ------------------------------------------------------------ resultados por passo */
  const chip = (ok, txt) => `<span class="chip ${ok ? 'ok' : 'no'}"><i>${ok ? '✓' : '✕'}</i>${txt}</span>`;
  const tabela = (cab, linhas, pe) => `<div class="tablewrap"><table class="t"><thead><tr>${cab.map((c, i) => `<th class="${i ? 'num' : ''}">${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => '<tr>' + l.map((c, i) => `<td class="${i ? 'num' : ''}">${c}</td>`).join('') + '</tr>').join('')}</tbody>${pe ? '<tfoot><tr>' + pe.map((c, i) => `<td class="${i ? 'num' : ''}">${c}</td>`).join('') + '</tr></tfoot>' : ''}</table></div>`;
  function render() {
    const r = R, n = r.n;
    const vazio = `<p class="res-s">${t('land.vazio')}</p>`;
    // status geral
    $('d-status').innerHTML = !n ? '' : [
      chip(r.lancavel, `T* = ${mo(r.T)} ${r.lancavel ? '≤' : '>'} F = ${mo(35)}`),
      chip(r.m >= 6, `Σm = ${br(r.m, 0)} ${r.m >= 6 ? '≥' : '<'} m̄ = 6`),
      chip(r.zeta >= 0.5 - 1e-12, `ζ = ${br(r.zeta, 2)} ${r.zeta >= 0.5 - 1e-12 ? '≥' : '<'} ${br(0.5, 2)}`),
    ].join('');
    $('d-sum').innerHTML = n ? `𝒜 = <b>${mo(r.A)}</b> ${esc(U)} · T* = <b>${mo(r.T)}</b> · ${t('xa.eq')}: <b>${r.xA ? lista(r.xA.ids) : '—'}</b>` : t('land.vazio');
    // 1. valor azul
    if (!n) { for (let i = 1; i <= 7; i++) $('r' + i).innerHTML = vazio; diagrama(); return; }
    let sV = 0, sE = 0;
    const l1 = r.sel.map(id => { const m = M.mods.find(x => x.id === id); sV += m.V; sE += m.E; return [`<b>${id}</b> <span class="nm">${esc(nomeG(id))}</span>`, br(m.V), br(m.E), br(m.V + m.E)]; });
    $('r1').innerHTML = tabela([t('modulo'), 'V', 'E', 'V + E'], l1, [t('total'), br(sV), br(sE), br(sV + sE)])
      + `<p class="res-s">${t('land.s1.r', { grp: lista(r.sel), sve: br(sV + sE, 1), cs: br(r.Cs, 1), A: br(r.A, 1), u: esc(U) })}</p>`;
    // 2. cascata
    const fl = r.fluxos.filter(f => f.q > 1e-12);
    $('r2').innerHTML = (fl.length ? tabela([t('cas.h.f'), 'q', 's', 'ψ', t('cas.h.vp')], fl.map(f => [`${esc(I.fluxo(f.tipo))} <span class="mono">${f.de} → ${f.para}</span>`, br(f.q, 0) + ' ' + esc(f.un), br(f.s, f.s < 1 ? 3 : 1), br(f.psi, 2), br(f.vps, 1)]))
      + `<p class="res-s">${t('land.s2.r', { n: fl.length, C: br(r.C, 1), Cs: br(r.Cs, 1), u: esc(U) })}</p>` : `<p class="res-s">${t('land.s2.r0')}</p>`);
    // 3. jogo
    const igual = r.best && r.best.ids.length === r.sel.length;
    $('r3').innerHTML = tabela([t('land.s3.sub'), 'f<sub>γ</sub>(R)'], r.subs.slice(0, 6).map(s => [`<span class="mono">${lista(s.ids)}</span>${r.best && s.S === r.best.S ? ` <span class="tag">${t('land.s3.melhor')}</span>` : ''}`, br(s.f, 1)]))
      + `<p class="res-s">${t(igual ? 'land.s3.r.eq' : 'land.s3.r', { g: br(st.g, 2), f: br(r.f, 1), v: br(r.v, 1), best: r.best ? lista(r.best.ids) : t('nenhum'), u: esc(U) })}</p>`;
    // 4. título
    const h4 = $('r4');
    h4.innerHTML = `<div class="chart" id="ch4"></div><p class="res-s">${r.T <= 1e-6 ? t('land.s4.r0') : t('land.s4.r', { T: br(r.T, 1), def: br(r.deficits, 1), F: br(35, 0), u: esc(U), lanca: t(r.lancavel ? 'land.s4.sim' : 'land.s4.nao') })}</p>`;
    Charts.hbar($('ch4'), { rows: [{ label: 'T*', values: [r.T] }, { label: t('land.s4.def'), values: [r.deficits] }, { label: t('land.s4.F'), values: [35] }],
      series: [{ name: esc(U), color: 'var(--s1)' }], W: Math.max(300, Math.min(640, $('ch4').clientWidth || 520)), labelW: 170, valueFmt: v => br(v, 1), interactive: true });
    // 5. partilha
    $('r5').innerHTML = `<div class="chart" id="ch5"></div><p class="res-s">${t('land.s5.r', { T: br(r.T, 1), u: esc(U) })} ${t(r.shapNucleo ? 'land.s5.in' : 'land.s5.out')}</p>`;
    Charts.divbar($('ch5'), { rows: r.sel.map(id => ({ label: id + ' ' + t('garuva.s.' + id), v: r.t[id] })), W: Math.max(300, Math.min(640, $('ch5').clientWidth || 520)), labelW: 150,
      pos: { name: t('land.s5.pos'), color: 'var(--s1)' }, neg: { name: t('land.s5.neg'), color: 'var(--s2)' }, valueFmt: v => br(v, 1) });
    // 6. necessidades e regeneração
    const met = (lb, v, lim, max, ok) => `<div class="meter"><div class="mt-l"><span>${lb}</span><b>${chip(ok, '')}</b></div><div class="mt-bar"><i style="width:${Math.min(100, 100 * v / max)}%"></i><s style="left:${100 * lim / max}%"></s></div></div>`;
    $('r6').innerHTML = met(`Σm = ${br(r.m, 0)} · m̄ = 6`, r.m, 6, 10, r.m >= 6) + met(`ζ = ${br(r.zeta, 2)} · 1/(1+θ) = ${br(0.5, 2)}`, r.zeta, 0.5, 1, r.zeta >= 0.5 - 1e-12)
      + `<p class="res-s">${t('land.s6.r', { m: br(r.m, 0), mbar: 6, z: br(r.zeta, 2), lim: br(0.5, 2) })}</p>`;
    // 7. indicadores e equilíbrio azul
    const k = (lb, v) => `<div class="kpi"><span class="lb">${lb}</span><b>${v}</b></div>`;
    const xa = r.xA ? lista(r.xA.ids) : t('land.s7.nada');
    $('r7').innerHTML = `<div class="kpis k3">${k('E<sup>N</sup>', I.pct(r.E_N))}${k('λ<sub>T</sub>', r.lamT == null ? '—' : br(r.lamT, 1))}${k('γ*', r.gStar == null ? '—' : br(r.gStar, 2))}</div>`
      + `<p class="res-s">${t('land.s7.r', { xa: `<b>${xa}</b>`, nv: r.nViaveis, nc: r.nCand })} ${r.igual ? t('land.s7.igual') : ''}</p>`
      + (r.xA && !r.igual ? `<button class="btn pri sm" type="button" id="d-marca">${t('land.s7.btn')}</button>` : '');
    const bm = $('d-marca'); if (bm) bm.addEventListener('click', () => { st.sel = r.xA.ids.slice(); controles(); calcular(); });
    diagrama();
  }

  /* ------------------------------------------------------------ diagrama do biossistema */
  const POS = { G1: [2, 12], G2: [268, 12], G4: [2, 186], G3: [268, 186] }, BW = 150, BH = 62;
  const SETAS = [
    { a: 'G1', b: 'G2', tipo: 'CO₂', d: 'M152,36 L262,36', lx: 207, ly: [12, 26], an: 'middle' },
    { a: 'G1', b: 'G2', tipo: 'digestato', d: 'M152,60 L262,60', lx: 207, ly: [78, 92], an: 'middle' },
    { a: 'G1', b: 'G4', tipo: 'digestato', d: 'M77,74 L77,180', lx: 86, ly: [120, 134], an: 'start' },
    { a: 'G2', b: 'G3', tipo: 'microalgas', d: 'M343,74 L343,180', lx: 334, ly: [120, 134], an: 'end' },
  ];
  function diagrama() {
    const r = R, on = id => st.sel.includes(id), p = st.passo;
    const fl = (r && r.fluxos) || [], ativo = (de, para, tipo) => fl.find(f => f.de === de && f.para === para && I.fluxo(f.tipo) === I.fluxo(tipo) && f.q > 1e-12);
    const destaque = new Set(p === 3 && r && r.best ? r.best.ids : p === 7 && r && r.xA ? r.xA.ids : []);
    const val = id => {
      if (!r || !r.n || !on(id)) return '';
      const m = M.mods.find(x => x.id === id);
      if (p === 1) return 'V + E = ' + br(m.V + m.E, 0);
      if (p === 5) return 't = ' + br(r.t[id], 1);
      if (p === 6) return 'm = ' + br(m.m, 0);
      if (p === 3 || p === 4) return 'V + γE = ' + br(m.V + st.g * m.E, 1);
      return 'V = ' + br(m.V, 0);
    };
    const seta = o => {
      const f = on(o.a) && on(o.b) && ativo(o.a, o.b, o.tipo), hi = f && (p === 2 || (p === 6 && f.regen));
      const q = f && (p === 2 || p === 6) ? br(f.q, 0) + ' ' + f.un : '';
      return `<path d="${o.d}" class="dg-f${f ? ' on' : ''}${hi ? ' hi' : ''}" marker-end="url(#dg-ar${hi ? 'h' : f ? 'o' : ''})"/>`
        + `<text x="${o.lx}" y="${o.ly[0]}" class="dg-fl${f ? '' : ' off'}" text-anchor="${o.an}">${esc(I.fluxo(o.tipo))}</text>`
        + (q ? `<text x="${o.lx}" y="${o.ly[1]}" class="dg-fl q" text-anchor="${o.an}">${esc(q)}</text>` : '');
    };
    let s = `<svg viewBox="0 0 420 250" class="dg" role="img" aria-label="${esc(t('land.diag.aria'))}"><defs>`
      + ['', 'o', 'h'].map(k => `<marker id="dg-ar${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="dg-ar${k}"/></marker>`).join('') + '</defs>';
    s += SETAS.map(seta).join('');
    IDS.forEach(id => {
      const [x, y] = POS[id], cls = 'dg-n' + (on(id) ? ' on' : '') + (destaque.has(id) ? ' hi' : '');
      s += `<g class="${cls}" data-id="${id}" tabindex="0" role="button" aria-pressed="${on(id)}"><rect x="${x}" y="${y}" width="${BW}" height="${BH}" rx="8"/>`
        + `<text x="${x + 10}" y="${y + 24}" class="dg-id">${id}</text><text x="${x + 38}" y="${y + 24}" class="dg-nm">${esc(t('garuva.s.' + id))}</text>`
        + `<text x="${x + 10}" y="${y + 47}" class="dg-v">${esc(val(id))}</text></g>`;
    });
    const nota = !r || !r.n ? '' : p === 4 ? 'T* = ' + br(r.T, 1) + ' · F = 35' : p === 6 ? 'ζ = ' + br(r.zeta, 2) : p === 7 ? 'xᴬ = ' + (r.xA ? lista(r.xA.ids) : '—') : '';
    if (nota) s += `<text x="210" y="166" text-anchor="middle" class="dg-v dg-nota">${esc(nota)}</text>`;
    $('d-diag').innerHTML = s + '</svg>';
  }
  $('d-diag').addEventListener('click', e => {
    const g = e.target.closest('[data-id]'); if (!g) return;
    const id = g.dataset.id; st.sel = st.sel.includes(id) ? st.sel.filter(x => x !== id) : IDS.filter(x => x === id || st.sel.includes(x));
    controles(); calcular();
  });
  $('d-diag').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.id) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });

  /* ------------------------------------------------------------ passo ativo (rolagem) */
  const passos = [...document.querySelectorAll('.stp')];
  function ativa(p) {
    if (p === st.passo) return; st.passo = p;
    passos.forEach(el => el.classList.toggle('on', +el.dataset.p === p));
    document.querySelectorAll('#d-nav a').forEach(a => a.setAttribute('aria-current', String(+a.dataset.p === p)));
    diagrama();
  }
  if ('IntersectionObserver' in window) {
    const vis = new Map();
    const io = new IntersectionObserver(es => {
      es.forEach(e => vis.set(+e.target.dataset.p, e.intersectionRatio));
      let best = st.passo, bv = 0; vis.forEach((v, k) => { if (v > bv) { bv = v; best = k; } });
      if (bv > 0) ativa(best);
    }, { rootMargin: '-35% 0px -45% 0px', threshold: [0, 0.01, 0.25, 0.5, 1] });
    passos.forEach(el => io.observe(el));
  }
  passos.forEach(el => el.addEventListener('focusin', () => ativa(+el.dataset.p)));

  document.addEventListener('ea-lang', () => { kpis(); controles(); calcular(); });
  document.addEventListener('ea-tema', () => render());
  let lw = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lw) > 40) { lw = window.innerWidth; render(); } });
  kpis(); controles(); calcular();
  passos[0] && passos[0].classList.add('on');
  window.__pronto = true;
})();
