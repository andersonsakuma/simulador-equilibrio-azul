/* Dashboard: panorama dos 101 lotes da Bolsa Azul ZERI (recalculado pelo motor) e painel do local em análise no simulador. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = window.DADOS, EN = window.Engine, ST = window.Estado, I = window.I18N, t = I.t, br = I.num, pct = I.pct;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lista = ids => ids.slice().sort(ST.ordId).join(', ');
  const mi = v => br(v / 1e6, 2) + ' ' + t('u.mi');
  const kpi = (lb, v, ft) => `<div class="kpi"><span class="lb">${lb}</span><b>${v}</b><span class="ft">${ft || ''}</span></div>`;
  const W = host => Math.max(300, Math.round(host.clientWidth || 600));
  const S0 = ST.carregar();
  const P = { gamma: +S0.cfgPais.gamma || 0, co2: S0.prm.p_co2, calor: S0.calor, macro: '', met: 'T' };
  const MACROS = [...new Set(D.paises.map(p => p.macro))];

  /* ============================================================ panorama dos 101 países */
  let RK = null, chave = '', job = 0;
  function calcular() {
    const prm = Object.assign({}, S0.prm, { p_co2: P.co2 }), ch = JSON.stringify([prm, P.calor, P.gamma]);
    if (RK && ch === chave) { renderGeral(); return; }
    chave = ch; const meu = ++job, novo = []; let i = 0;
    const bar = $('g-prog').firstElementChild; $('p-geral').classList.add('busy');
    const passo = () => {
      if (meu !== job) return;
      const t0 = performance.now();
      while (i < D.paises.length && performance.now() - t0 < 30) {
        const p = D.paises[i++], md = EN.modeloPais(p, D, prm, { calor: P.calor }), lp = ST.lotePais(p);
        const r = EN.avaliar(md, { gamma: P.gamma, sel: lp.sel, universo: lp.busca, obrig: lp.obrig, maxTam: lp.sel.length, nucleo: false, curva: true, top: 1 });
        novo.push({ pais: p.nome, macro: p.macro, lote: lp.sel, tit: r.tit, T: r.T, A: r.A, AN: r.A_N, EN: r.E_N, lamT: r.lamT, g: r.gStar, igual: r.igual,
                    xA: r.xA && !r.igual ? r.xA.ids : null, ganho: r.xA && !r.igual ? r.xA.A - r.A : 0, TxA: r.xA ? r.xA.T : null, curva: r.curva.map(c => c.T) });
      }
      bar.style.width = (100 * i / D.paises.length) + '%'; bar.parentElement.style.visibility = 'visible';
      if (i < D.paises.length) setTimeout(passo, 0);
      else { RK = novo; bar.parentElement.style.visibility = 'hidden'; $('p-geral').classList.remove('busy'); renderGeral(); }
    };
    passo();
  }
  const filtrados = () => (RK || []).filter(r => !P.macro || r.macro === P.macro);

  function renderGeral() {
    if (!RK) return;
    const L = filtrados(), soma = k => L.reduce((s, r) => s + (r[k] || 0), 0);
    const sT = soma('T'), sB = soma('tit'), sA = soma('A'), sAN = soma('AN'), sG = soma('ganho');
    const gs = L.map(r => r.g).filter(g => g != null).sort((a, b) => a - b), nz = L.length - gs.length;
    const med = gs.length ? (gs.length % 2 ? gs[(gs.length - 1) / 2] : (gs[gs.length / 2 - 1] + gs[gs.length / 2]) / 2) : null;
    $('g-kpis').innerHTML = kpi(t('kpi.T'), mi(sT), t('kpi.T.bolsa', { v: mi(sB) }) + (sB ? ' (' + (sT >= sB ? '+' : '') + pct((sT - sB) / sB, 1) + ')' : ''))
      + kpi(t('kpi.A') + ' 𝒜', mi(sA), t('land.k2.ft'))
      + kpi(t('dash.k.eq'), t('r.k.eq.v', { a: L.filter(r => r.igual).length, b: L.length }), t('r.k.eq.ft'))
      + kpi(t('r.k.ganho'), mi(sG), t('r.k.ganho.ft'))
      + kpi(t('dash.k.EN'), pct(sA ? sAN / sA : null), t('dash.k.EN.ft'))
      + kpi(t('dash.k.g'), med == null ? '—' : br(med, 2), nz ? t('dash.k.g.nz', { n: nz }) : t('dash.k.g.ft'));
    mapa(L); barrasMacro(L); curvaTotal(L); histGamma(L); dispersao(L); tabela(L);
  }

  /* --- mapa em quadrados por macrorregião */
  const METS = {
    T: { v: r => r.T, f: v => br(v / 1e3, 0) + ' ' + t('u.mil'), lb: () => t('kpi.T') + ' (USD)' },
    A: { v: r => r.A, f: v => mi(v), lb: () => t('kpi.A') + ' 𝒜 (USD)' },
    lamT: { v: r => r.lamT, f: v => br(v, 1), lb: () => 'λT' },
    EN: { v: r => r.EN, f: v => pct(v), lb: () => 'Eᴺ' },
    g: { v: r => r.g, f: v => br(v, 2), lb: () => 'γ*' },
    dif: { v: r => r.T - r.tit, f: v => (v > 0 ? '+' : '') + br(v / 1e3, 0) + ' ' + t('u.mil'), lb: () => t('dash.met.dif'), div: true },
  };
  function quebras(vals, div) {
    const v = vals.filter(x => x != null && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return [];
    if (div) { const m = Math.max(...v.map(Math.abs)) || 1; return [-m * 0.5, -m * 0.1, m * 0.1, m * 0.5]; }
    return [0.2, 0.4, 0.6, 0.8].map(q => v[Math.min(v.length - 1, Math.floor(q * v.length))]);
  }
  const classe = (v, qb) => { if (v == null || !isFinite(v)) return -1; let k = 0; while (k < qb.length && v > qb[k]) k++; return k; };
  function mapa(L) {
    const m = METS[P.met], vals = RK.map(m.v), qb = quebras(vals, m.div), pre = m.div ? 'd' : 'q';
    const em = new Set(L.map(r => r.pais));
    let h = '';
    MACROS.forEach(mc => {
      const rs = RK.filter(r => r.macro === mc).sort((a, b) => I.pais(a.pais).localeCompare(I.pais(b.pais), I.loc()));
      h += `<div class="mg${P.macro && P.macro !== mc ? ' fade' : ''}"><div class="mg-t">${esc(I.macro(mc))}</div><div class="mg-tiles">`
        + rs.map(r => { const v = m.v(r), k = classe(v, qb); return `<a class="tile ${k < 0 ? 'na' : pre + k}${em.has(r.pais) ? '' : ' off'}" href="simulador.html#pais=${encodeURIComponent(r.pais)}" data-p="${esc(r.pais)}" aria-label="${esc(I.pais(r.pais))}: ${esc(v == null ? '—' : m.f(v))}">${I.iso(r.pais)}</a>`; }).join('')
        + '</div></div>';
    });
    $('g-map').innerHTML = h;
    const vmin = Math.min(...vals.filter(v => v != null)), vmax = Math.max(...vals.filter(v => v != null));
    const lims = [vmin].concat(qb, [vmax]);
    $('g-leg').innerHTML = `<span class="lg-t">${esc(m.lb())}</span>` + [0, 1, 2, 3, 4].map(k => `<span class="lg-i"><i class="tile ${pre + k}"></i>${esc(m.f(lims[k]))} – ${esc(m.f(lims[k + 1]))}</span>`).join('')
      + (vals.some(v => v == null) ? `<span class="lg-i"><i class="tile na"></i>${t('dash.na')}</span>` : '');
  }
  const tipMap = (() => {
    let tt = null;
    const show = (a, x, y) => {
      const r = RK && RK.find(z => z.pais === a.dataset.p); if (!r) return;
      if (!tt) { tt = document.createElement('div'); tt.className = 'ch-tt'; document.body.appendChild(tt); tt.style.position = 'fixed'; }
      tt.innerHTML = `<b>${esc(I.pais(r.pais))}</b><br>T* ${mi(r.T)} · 𝒜 ${mi(r.A)}<br>Eᴺ ${pct(r.EN)} · λT ${r.lamT == null ? '—' : br(r.lamT, 1)} · γ* ${r.g == null ? '—' : br(r.g, 2)}<br>${r.igual ? t('chip.igual') : t('xa.eq') + ': ' + lista(r.xA || [])}`;
      tt.hidden = false; const w = tt.offsetWidth;
      tt.style.left = Math.min(window.innerWidth - w - 8, x + 12) + 'px'; tt.style.top = Math.max(8, y - tt.offsetHeight - 10) + 'px';
    };
    return { show, hide() { if (tt) tt.hidden = true; } };
  })();
  $('g-map').addEventListener('mousemove', e => { const a = e.target.closest('.tile'); if (a) tipMap.show(a, e.clientX, e.clientY); else tipMap.hide(); });
  $('g-map').addEventListener('mouseleave', () => tipMap.hide());
  $('g-map').addEventListener('focusin', e => { const a = e.target.closest('.tile'); if (a) { const b = a.getBoundingClientRect(); tipMap.show(a, b.left, b.top); } });
  $('g-map').addEventListener('focusout', () => tipMap.hide());

  /* --- título por macrorregião (ou por país dentro da macrorregião filtrada) */
  function barrasMacro(L) {
    let rows;
    if (P.macro) {
      $('g-macro-t').textContent = t('dash.macro.t2', { m: I.macro(P.macro) });
      rows = L.slice().sort((a, b) => b.T - a.T).slice(0, 15).map(r => ({ label: I.pais(r.pais), values: [r.T / 1e6] }));
    } else {
      $('g-macro-t').textContent = t('dash.macro.t');
      rows = MACROS.map(mc => ({ label: I.macro(mc), values: [RK.filter(r => r.macro === mc).reduce((s, r) => s + r.T, 0) / 1e6] })).sort((a, b) => b.values[0] - a.values[0]);
    }
    const host = $('g-macro');
    Charts.hbar(host, { rows, series: [{ name: 'T*', color: 'var(--s1)' }], W: W(host), labelW: Math.min(230, W(host) * 0.42), valueFmt: v => br(v, 2), interactive: true });
  }

  /* --- título total conforme a confiança */
  function curvaTotal(L) {
    const host = $('g-curva'), xs = Array.from({ length: 21 }, (_, i) => i / 20);
    const ys = xs.map((_, i) => L.reduce((s, r) => s + r.curva[i], 0) / 1e6);
    const gi = Math.min(19, Math.floor(P.gamma * 20)), fr = Math.max(0, Math.min(1, (P.gamma - gi / 20) / 0.05)), yg = ys[gi] + (ys[gi + 1] - ys[gi]) * fr;
    const ymax = Math.max(...ys) * 1.12 || 1;
    Charts.lines(host, { series: [{ name: 'T*', color: 'var(--s1)', x: xs, y: ys }], W: W(host), H: 250, xLabel: t('ch.gamma.x'), xName: 'γ', yLabel: 'T* (' + t('u.mi.longo', { u: 'USD' }) + ')',
      xDomain: [0, 1], yDomain: [0, ymax], xFmt: v => br(v, 2), yFmt: v => br(v, ymax < 10 ? 1 : 0), interactive: true,
      marks: [{ x: P.gamma, y: yg, label: `γ = ${br(P.gamma, 2)}: ${br(yg, 2)} ${t('u.mi')}`, color: 'var(--s1)', anchor: P.gamma > 0.6 ? 'end' : 'start', dx: P.gamma > 0.6 ? -8 : 8 }] });
  }

  /* --- distribuição de γ* */
  function histGamma(L) {
    const lim = [0, 0.2, 0.4, 0.6, 0.8, 1], c = [0, 0, 0, 0, 0, 0, 0];
    L.forEach(r => { if (r.g == null) c[6]++; else if (r.g <= 1e-9) c[0]++; else c[Math.min(5, Math.ceil(r.g / 0.2 - 1e-9))]++; });
    const labels = ['0'].concat(lim.slice(1).map(v => '≤ ' + br(v, 1)), [t('dash.gs.nz')]);
    const host = $('g-gstar');
    Charts.columns(host, { labels, values: c, color: 'var(--s1)', W: W(host), H: 230, valueFmt: v => br(v, 0), interactive: true, name: t('dash.gs.n') });
  }

  /* --- valor azul × título */
  function dispersao(L) {
    const host = $('g-scat'), pt = r => ({ x: r.T / 1e3, y: r.A / 1e6, label: I.pais(r.pais), r });
    Charts.scatter(host, {
      series: [{ name: t('dash.sc.eq'), color: 'var(--s1)', pts: L.filter(r => r.igual).map(pt) }, { name: t('dash.sc.melhor'), color: 'var(--s2)', pts: L.filter(r => !r.igual).map(pt) }],
      W: W(host), H: 300, xLabel: 'T* (' + t('u.mil.longo', { u: 'USD' }) + ')', yLabel: '𝒜 (' + t('u.mi.longo', { u: 'USD' }) + ')', xFmt: v => br(v, 0), yFmt: v => br(v, 0),
      tip: (p, s) => `<b>${esc(p.label)}</b><br><i class="lk" style="background:${s.color}"></i>${esc(s.name)}<br>T* <b>${br(p.x, 0)}</b> ${t('u.mil')} · 𝒜 <b>${br(p.y, 2)}</b> ${t('u.mi')}`,
      onClick: p => { location.href = 'simulador.html#pais=' + encodeURIComponent(p.r.pais); },
    });
  }

  /* --- lotes com agrupamento melhor */
  function tabela(L) {
    const rs = L.filter(r => !r.igual).sort((a, b) => b.ganho - a.ganho);
    if (!rs.length) { $('g-tab').innerHTML = `<div class="empty">${t('dash.tab.vazio')}</div>`; return; }
    $('g-tab').innerHTML = `<div class="tablewrap"><table class="t"><thead><tr><th>${t('pais')}</th><th>${t('lote')}</th><th>${t('col.eq')}</th><th class="num">${t('r.h.ganho')} 𝒜</th><th class="num">T* ${t('dash.tab.lote')}</th><th class="num">T* ${t('dash.tab.eq')}</th></tr></thead><tbody>`
      + rs.map(r => `<tr><td><a class="lk" href="simulador.html#pais=${encodeURIComponent(r.pais)}">${esc(I.pais(r.pais))}</a><span class="nm">${esc(I.macro(r.macro))}</span></td><td class="mono">${lista(r.lote)}</td><td class="mono">${r.xA ? lista(r.xA) : t('nenhum')}</td><td class="num">${br(r.ganho)}</td><td class="num">${br(r.T)}</td><td class="num">${r.TxA == null ? '—' : br(r.TxA)}</td></tr>`).join('')
      + `</tbody></table></div><p class="note">${t('dash.tab.nota', { n: rs.length, g: mi(rs.reduce((s, r) => s + r.ganho, 0)) })}</p>`;
  }
  $('g-csv').addEventListener('click', () => {
    if (!RK) return;
    const en = I.lang() === 'en', sep = en ? ',' : ';', cell = v => { const s = typeof v === 'number' ? String(Math.round(v * 1000) / 1000).replace('.', en ? '.' : ',') : String(v == null ? '' : v); return s.includes(sep) || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [[t('pais'), 'ISO', t('macro'), t('lote'), t('r.h.tit') + ' (USD)', 'T* (USD)', 'A (USD)', 'E^N', 'lambda_T', 'gamma*', t('col.eq'), t('r.h.ganho') + ' A (USD)']]
      .concat(filtrados().map(r => [I.pais(r.pais), I.iso(r.pais), I.macro(r.macro), lista(r.lote), r.tit, r.T, r.A, r.EN, r.lamT, r.g, r.igual ? t('r.proprio') : lista(r.xA || []), r.ganho]));
    const b = new Blob(['﻿' + rows.map(r => r.map(cell).join(sep)).join('\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'dashboard_equilibrio_azul.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  /* --- filtros */
  function filtros() {
    $('g-gam').value = P.gamma; $('g-gam-v').textContent = br(P.gamma, 2); $('g-co2').value = P.co2; $('g-calor').checked = P.calor;
    $('g-macro-f').innerHTML = `<option value="">${t('r.todas')}</option>` + MACROS.map(m => `<option value="${esc(m)}" ${m === P.macro ? 'selected' : ''}>${esc(I.macro(m))}</option>`).join('');
    $('g-met').innerHTML = Object.keys(METS).map(k => `<option value="${k}" ${k === P.met ? 'selected' : ''}>${esc(t('dash.met.' + k))}</option>`).join('');
  }
  let tmr = null; const agenda = () => { clearTimeout(tmr); tmr = setTimeout(calcular, 120); };
  $('g-gam').addEventListener('input', e => { P.gamma = +e.target.value; $('g-gam-v').textContent = br(P.gamma, 2); agenda(); });
  $('g-co2').addEventListener('input', e => { const v = parseFloat(e.target.value); P.co2 = isFinite(v) && v >= 0 ? v : 0; agenda(); });
  $('g-calor').addEventListener('change', e => { P.calor = e.target.checked; agenda(); });
  $('g-macro-f').addEventListener('change', e => { P.macro = e.target.value; renderGeral(); });
  $('g-met').addEventListener('change', e => { P.met = e.target.value; if (RK) mapa(filtrados()); });
  $('g-reset').addEventListener('click', () => { Object.assign(P, { gamma: 0, co2: 335, calor: false, macro: '' }); filtros(); calcular(); });

  /* ============================================================ local em análise */
  let LS = null;
  function fontes() {
    const s = ST.carregar(), nome = s.modo === 'pais' ? I.pais(s.pais) : s.local.nome;
    const v = $('l-src').value || 'salvo';
    $('l-src').innerHTML = `<option value="salvo">${esc(t('dash.l.salvo', { n: nome }))}</option><optgroup label="${esc(t('dash.l.paises'))}">`
      + D.paises.map(p => ({ v: p.nome, n: I.pais(p.nome) })).sort((a, b) => a.n.localeCompare(b.n, I.loc())).map(o => `<option value="${esc(o.v)}">${esc(o.n)}</option>`).join('') + '</optgroup>';
    $('l-src').value = v;
  }
  function calcLocal() {
    const s = ST.carregar(), v = $('l-src').value || 'salvo';
    let S = s;
    if (v !== 'salvo') S = { modo: 'pais', pais: v, prm: s.prm, calor: s.calor, cfgPais: Object.assign({}, ST.CFG0, ST.lotePais(ST.paisDe(v)), { gamma: s.cfgPais.gamma }), local: s.local };
    const M = ST.modelo(S);
    let R; try { R = ST.avaliar(S, M); } catch (e) { R = { erro: e.message }; }
    LS = { S, M, R, u: M.moeda };
    $('l-abrir').href = v === 'salvo' ? 'simulador.html' : 'simulador.html#pais=' + encodeURIComponent(v);
    $('l-aviso').hidden = !(v === 'salvo' && !s.salvo);
    renderLocal();
  }
  function renderLocal() {
    if (!LS) return;
    const { S, M, R, u } = LS, pais = S.modo === 'pais', money = (v, l) => I.money(v, u, l);
    if (pais) { const p = ST.paisDe(S.pais); $('l-nome').textContent = I.pais(S.pais); $('l-meta').textContent = t('pais.meta', { macro: I.macro(p.macro), leitura: I.leitura(p.leitura), idh: br(p.idh, 3), taxa: pct(p.taxa, 0), W: br(p.W, 2) }); }
    else { $('l-nome').textContent = S.local.nome || t('local.novo'); $('l-meta').textContent = t('local.meta', { m: S.local.mods.length, f: S.local.links.length }) + ' · ' + u; }
    if (R.erro || !R.n) { $('l-kpis').innerHTML = ''; $('l-chips').innerHTML = `<span class="chip wn"><i>!</i>${esc(R.erro || t('kpi.marque'))}</span>`; ['l-wf', 'l-t', 'l-curva', 'l-cas', 'l-cmp'].forEach(id => { $(id).innerHTML = ''; }); return; }
    const gtxt = R.gStar == null ? t('kpi.g.nao') : R.gStar === 0 ? t('kpi.g.zero') : t('kpi.g.disp');
    $('l-kpis').innerHTML = kpi(t('kpi.A') + ' 𝒜', money(R.A), t('kpi.A.ft', { u })) + kpi(t('kpi.T'), money(R.T), pais ? t('kpi.T.bolsa', { v: money(R.tit) }) : t('kpi.T.def', { v: money(R.deficits) }))
      + kpi(t('kpi.EN'), pct(R.E_N), R.xN.length ? t('kpi.EN.so', { v: lista(R.xN) }) : t('kpi.EN.nenhum')) + kpi(t('kpi.lam'), R.lamT == null ? '—' : br(R.lamT, 1), t('kpi.lam.ft'))
      + kpi(t('kpi.g'), R.gStar == null ? '—' : br(R.gStar, 2), gtxt);
    const chip = (c, x) => `<span class="chip ${c}"><i>${c === 'ok' ? '✓' : c === 'no' ? '✕' : '!'}</i>${x}</span>`, okM = R.m >= R.mbar - 1e-9, okZ = R.zeta >= R.limZ - 1e-12;
    $('l-chips').innerHTML = chip(R.lancavel ? 'ok' : 'no', t('chip.F', { op: R.lancavel ? '≤' : '>', F: money(R.F) })) + chip(okM ? 'ok' : 'no', t('chip.m', { m: br(R.m, 1), op: okM ? '≥' : '<', mb: br(R.mbar, 1) }))
      + (R.regenAplicada ? chip(okZ ? 'ok' : 'no', t('chip.z', { z: br(R.zeta, 2), op: okZ ? '≥' : '<', l: br(R.limZ, 2) })) : chip('wn', t('chip.z0')))
      + (R.nucleoVazio ? chip('no', t('chip.nv', { v: money(R.T_LP) })) : chip('ok', t(R.shapNucleo ? 'chip.nin' : 'chip.nout')))
      + chip(R.igual ? 'ok' : 'wn', t(R.igual ? 'chip.igual' : R.xA ? 'chip.melhor' : 'chip.nada'));
    const sel = R.sel.slice().sort(ST.ordId), g = +ST.cfgDe(S).gamma || 0;
    // composição do valor azul (cascata de barras)
    const sV = sel.reduce((s, id) => s + M.mods.find(m => m.id === id).V, 0), sE = sel.reduce((s, id) => s + M.mods.find(m => m.id === id).E, 0);
    ponte($('l-wf'), [{ lb: t('dash.wf.V'), v: sV }, { lb: t('dash.wf.E'), v: sE }, { lb: t('dash.wf.C'), v: R.Cs }], { lb: t('dash.wf.A'), v: R.A }, v => money(v));
    // título por módulo
    const nomeMod = id => (pais ? I.modulo(id, M.mods.find(m => m.id === id).nome) : M.mods.find(m => m.id === id).nome);
    Charts.divbar($('l-t'), { rows: sel.map(id => ({ label: id, v: R.t[id], nome: nomeMod(id) })), W: W($('l-t')), labelW: 60, pos: { name: t('land.s5.pos'), color: 'var(--s1)' }, neg: { name: t('land.s5.neg'), color: 'var(--s2)' }, valueFmt: v => money(v) });
    $('l-t-leg').innerHTML = sel.map(id => `<span><b>${id}</b> ${esc(nomeMod(id))}</span>`).join('');
    // curva
    if (R.curva) Charts.curvaGamma($('l-curva'), R, g, u);
    // cascata
    const fl = R.fluxos.filter(f => f.q > 1e-12 && f.vps > 1e-9).sort((a, b) => b.vps - a.vps);
    if (fl.length) Charts.hbar($('l-cas'), { rows: fl.map(f => ({ label: `${I.fluxo(f.tipo)} ${f.de}→${f.para}`, values: [f.vps] })), series: [{ name: t('cas.h.vp'), color: 'var(--s1)' }], W: W($('l-cas')), labelW: Math.min(200, W($('l-cas')) * 0.42), valueFmt: v => money(v), interactive: true });
    else $('l-cas').innerHTML = `<div class="empty">${t('cas.vazio')}</div>`;
    // marcado × equilíbrio azul
    const x = R.xA, lin = (lb, a, b, f) => `<tr><td>${lb}</td><td class="num">${f(a)}</td><td class="num">${b == null ? '—' : f(b)}</td><td class="num">${b == null || a == null ? '—' : ((b - a >= 0 ? '+' : '') + f(b - a))}</td></tr>`;
    $('l-cmp').innerHTML = `<div class="tablewrap"><table class="t"><thead><tr><th></th><th class="num">${t('col.marcado')}: ${lista(R.sel)}</th><th class="num">${t('col.eq')}: ${x ? lista(x.ids) : '—'}</th><th class="num">${t('r.h.dif')}</th></tr></thead><tbody>`
      + lin(t('kpi.A') + ' 𝒜', R.A, x && x.A, v => money(v)) + lin('T*', R.T, x && x.T, v => money(v)) + lin('Σm', R.m, x && x.m, v => br(v, 1)) + (R.zeta != null ? lin('ζ', R.zeta, x && x.zeta, v => br(v, 2)) : '')
      + `</tbody></table></div><p class="note">${R.igual ? t('l.igual') : x ? t('l.xa', { F: money(R.F, true), x: lista(x.ids), A: money(x.A, true), T: money(x.T, true) }) : t('l.nada')}</p>`;
  }
  /* gráfico de ponte: do valor financeiro ao valor azul */
  function ponte(host, passos, tot, fmt) {
    host.innerHTML = '';
    const w = W(host), H = 244, L = 10, Rr = 10, T = 22, B = 48, NS = 'http://www.w3.org/2000/svg';
    const pts = []; let acc = 0;
    passos.forEach(p => { pts.push({ lb: p.lb, a: acc, b: acc + p.v, v: p.v }); acc += p.v; });
    pts.push({ lb: tot.lb, a: 0, b: tot.v, v: tot.v, tot: true });
    const lo = Math.min(0, ...pts.map(p => Math.min(p.a, p.b))), hi = Math.max(0, ...pts.map(p => Math.max(p.a, p.b))) || 1;
    const sy = v => T + (H - T - B) * (hi - v) / (hi - lo || 1), slot = (w - L - Rr) / pts.length, bw = Math.min(56, slot * 0.5);
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${w} ${H}`); svg.setAttribute('class', 'ch'); svg.setAttribute('role', 'img'); host.appendChild(svg);
    const el = (tag, at) => { const e = document.createElementNS(NS, tag); Object.keys(at).forEach(k => e.setAttribute(k, at[k])); svg.appendChild(e); return e; };
    el('line', { x1: L, x2: w - Rr, y1: sy(0), y2: sy(0), class: 'ch-axis' });
    pts.forEach((p, i) => {
      const cx = L + slot * (i + 0.5), y1 = sy(Math.max(p.a, p.b)), y2 = sy(Math.min(p.a, p.b));
      const cor = p.tot ? 'var(--accent)' : p.v >= 0 ? 'var(--s1)' : 'var(--s2)';
      el('rect', { x: cx - bw / 2, y: y1, width: bw, height: Math.max(1, y2 - y1), rx: 3, style: `fill:${cor}` });
      if (i < pts.length - 1 && !pts[i + 1].tot) el('line', { x1: cx + bw / 2, x2: cx + slot - bw / 2, y1: sy(p.b), y2: sy(p.b), class: 'ch-ref' });
      const ty = p.v >= 0 ? y1 - 6 : y2 + 14;
      el('text', { x: cx, y: ty, class: 'ch-val', 'text-anchor': 'middle' }).textContent = (p.tot || p.v < 0 ? '' : '+') + fmt(p.v);
      el('text', { x: cx, y: H - 8, class: 'ch-tick', 'text-anchor': 'middle' }).textContent = p.lb;
    });
  }
  $('l-src').addEventListener('change', calcLocal);

  /* ============================================================ abas, idioma, tema */
  const abas = ['t-geral', 't-local'];
  function abaSel(id) {
    abas.forEach(a => { const on = a === id; $(a).setAttribute('aria-selected', on); $(a.replace('t-', 'p-')).hidden = !on; });
    history.replaceState(null, '', id === 't-local' ? '#local' : '#geral');
    if (id === 't-local') { fontes(); calcLocal(); } else if (RK) renderGeral(); else calcular();
  }
  abas.forEach(a => $(a).addEventListener('click', () => abaSel(a)));
  $('t-geral').parentElement.addEventListener('keydown', e => {
    const i = abas.indexOf(document.activeElement.id); if (i < 0 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const j = (i + 1) % 2; $(abas[j]).focus(); abaSel(abas[j]);
  });
  const redesenha = () => { if (!$('p-geral').hidden) renderGeral(); else renderLocal(); };
  document.addEventListener('ea-lang', () => { filtros(); if (!$('p-local').hidden) fontes(); redesenha(); });
  document.addEventListener('ea-tema', redesenha);
  window.addEventListener('storage', e => { if (e.key === 'ea-estado' && !$('p-local').hidden) { fontes(); calcLocal(); } });
  let lw = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lw) > 40) { lw = window.innerWidth; clearTimeout(tmr); tmr = setTimeout(redesenha, 150); } });

  filtros();
  abaSel(location.hash === '#local' ? 't-local' : 't-geral');
  if (location.hash === '#local') calcular();
  window.__pronto = true;
})();
