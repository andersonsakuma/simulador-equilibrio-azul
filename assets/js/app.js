/* Simulador do Equilíbrio Azul — interface. O cálculo está em engine.js; o estado, em estado.js; os textos, em i18n.js. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = window.DADOS, EN = window.Engine, ST = window.Estado, I = window.I18N, t = I.t, SYM = window.SYM || {};
  const SA = `<span class="inl">${SYM.A || '𝒜'}</span>`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const br = I.num, pct = I.pct, num = ST.num, ordId = ST.ordId;
  const lista = ids => ids.slice().sort(ordId).join(', ');
  const tx = s => esc(I.fluxo(String(s == null ? '' : s)));
  const qf = v => br(v, Math.abs(v) < 100 && Math.abs(v - Math.round(v)) > 1e-9 ? 2 : 0);
  const nomeMod = m => (S.modo === 'pais' ? I.modulo(m.id, m.nome) : m.nome);

  /* ------------------------------------------------------------ estado */
  const S = ST.carregar();
  const h0 = decodeURIComponent((location.hash || '').slice(1));
  if (h0.startsWith('pais=')) { const n = h0.slice(5); if (ST.paisDe(n)) { S.pais = n; S.modo = 'pais'; Object.assign(S.cfgPais, ST.lotePais(ST.paisDe(n))); } }
  else if (h0 === 'local') S.modo = 'local';
  const cfg = () => ST.cfgDe(S);
  const paisAtual = () => ST.paisDe(S.pais);
  function abrirPais(nome) { S.pais = nome; Object.assign(S.cfgPais, ST.lotePais(paisAtual())); }

  let M = null, R = null;
  const moeda = () => (M ? M.moeda : 'USD');
  const money = (v, longo) => I.money(v, moeda(), longo);
  const full = v => (I.emMil(moeda()) ? br(v, 1) : br(v, 0));

  /* ------------------------------------------------------------ cálculo */
  function calcular() {
    M = ST.modelo(S);
    try { R = ST.avaliar(S, M); }
    catch (e) { R = { erro: /16/.test(e.message) ? t('erro.16') : e.message }; }
    render(); ST.salvar(S);
    if (S.modo === 'local') $('local-meta').textContent = t('local.meta', { m: S.local.mods.length, f: S.local.links.length });
    if (!R.erro) { $('f-val').placeholder = br(R.F, I.emMil(moeda()) ? 1 : 0); $('m-val').placeholder = br(R.mbar, 1); $('t-val').placeholder = String(R.maxTam > 16 ? '—' : R.maxTam); }
  }
  let tmr = null;
  const agenda = () => { clearTimeout(tmr); tmr = setTimeout(calcular, 70); };

  /* ------------------------------------------------------------ resultados */
  function render() {
    if (R.erro) { $('kpis').innerHTML = ''; $('chips').innerHTML = ''; $('leitura').textContent = R.erro; return; }
    renderKPIs(); renderChips(); renderLeitura(); renderXA(); renderPart(); renderCas(); renderCurva(); atualizaModStatus();
  }
  const kpi = (lb, v, ft) => `<div class="kpi"><span class="lb">${lb}</span><b>${v}</b><span class="ft">${ft || ''}</span></div>`;
  function renderKPIs() {
    const r = R, pais = S.modo === 'pais';
    const gtxt = r.gStar == null ? (r.n ? t('kpi.g.nao') : '') : r.gStar === 0 ? t('kpi.g.zero') : t('kpi.g.disp');
    $('kpis').innerHTML = !r.n ? kpi(t('kpi.A') + ' ' + SA, '—', t('kpi.marque')) : [
      kpi(t('kpi.A') + ' ' + SA, money(r.A), t('kpi.A.ft', { u: moeda() })),
      kpi(t('kpi.T'), money(r.T), pais ? t('kpi.T.bolsa', { v: money(r.tit) }) : t('kpi.T.def', { v: money(r.deficits) })),
      kpi(t('kpi.EN'), pct(r.E_N), r.xN.length ? t('kpi.EN.so', { v: lista(r.xN) }) : t('kpi.EN.nenhum')),
      kpi(t('kpi.lam'), r.lamT == null ? '—' : br(r.lamT, 1), t('kpi.lam.ft')),
      kpi(t('kpi.g'), r.gStar == null ? '—' : br(r.gStar, 2), gtxt),
    ].join('');
  }
  const chip = (cls, txt) => `<span class="chip ${cls}"><i>${cls === 'ok' ? '✓' : cls === 'no' ? '✕' : '!'}</i>${txt}</span>`;
  function renderChips() {
    const r = R; if (!r.n) { $('chips').innerHTML = ''; return; }
    const okM = r.m >= r.mbar - 1e-9, okZ = r.zeta >= r.limZ - 1e-12, c = [];
    c.push(chip(r.lancavel ? 'ok' : 'no', t('chip.F', { op: r.lancavel ? '≤' : '>', F: money(r.F) })));
    c.push(chip(okM ? 'ok' : 'no', t('chip.m', { m: br(r.m, 1), op: okM ? '≥' : '<', mb: br(r.mbar, 1) })));
    if (R.regenAplicada) c.push(chip(okZ ? 'ok' : 'no', t('chip.z', { z: br(r.zeta, 2), op: okZ ? '≥' : '<', l: br(r.limZ, 2) })));
    else c.push(chip('wn', t('chip.z0')));
    if (r.nucleoVazio) c.push(chip('no', t('chip.nv', { v: money(r.T_LP) })));
    else c.push(chip('ok', t(r.shapNucleo ? 'chip.nin' : 'chip.nout')));
    c.push(chip(r.igual ? 'ok' : 'wn', t(r.igual ? 'chip.igual' : r.xA ? 'chip.melhor' : 'chip.nada')));
    $('chips').innerHTML = c.join('');
  }
  function renderLeitura() {
    const r = R;
    if (!r.n) { $('leitura').innerHTML = t('l.marque'); return; }
    const nome = S.modo === 'pais' ? I.pais(S.pais) : (S.local.nome || t('l.local'));
    let s = t('l.a', { nome: esc(nome), grp: lista(r.sel), A: money(r.A, true) });
    s += r.Cs > 1e-9 ? t('l.cas', { C: money(r.Cs, true) }) : '. ';
    if (r.T <= 1e-6) s += t('l.semdoa');
    else {
      s += t('l.precisa', { T: money(r.T, true) });
      s += S.modo === 'pais' ? t('l.bolsa', { v: money(r.tit, true) }) : t('l.def', { v: money(r.deficits, true) });
      s += r.xN.length ? t('l.xn', { x: lista(r.xN), p: pct(r.E_N) }) : t('l.xn0');
      s += r.lamT != null ? t('l.lam', { v: br(r.lamT, 1) }) : '. ';
    }
    if (r.igual) s += t('l.igual');
    else if (r.xA) s += t('l.xa', { F: money(r.F, true), x: lista(r.xA.ids), A: money(r.xA.A, true), T: money(r.xA.T, true) });
    else s += t('l.nada');
    $('leitura').innerHTML = s;
  }
  function renderXA() {
    const r = R, x = r.xA, sg = v => (v >= 0 ? '+' : '') + money(v);
    let h = '';
    if (x) {
      h += `<div class="xa"><div><div class="grp">${lista(x.ids)}</div><div class="d">${SA} = ${money(x.A, true)} · T* = ${money(x.T, true)} · Σm = ${br(x.m, 1)}${x.zeta != null ? ' · ζ = ' + br(x.zeta, 2) : ''}`
        + (r.igual ? t('xa.marcado') : t('xa.rel', { dA: sg(x.A - r.A), dT: sg(x.T - r.T) })) + '</div></div>'
        + (r.igual ? '' : `<button class="btn pri sm" type="button" data-marca="${x.ids.join(',')}">${t('xa.btn')}</button>`) + '</div>';
    } else h += `<div class="empty">${t('xa.vazio')}</div>`;
    h += `<p class="note">${t('xa.note', { a: r.nViaveis, b: r.nCand, F: money(r.F, true), m: br(r.mbar, 1), z: R.regenAplicada ? ', ζ ≥ ' + br(r.limZ, 2) : '' })}</p>`;
    const sel = r.sel.slice().sort(ordId).join(',');
    const linha = c => {
      const eq = x && c.mask === x.mask, mk = c.ids.slice().sort(ordId).join(',') === sel;
      return `<tr class="${eq ? 'on' : ''}"><td class="mono">${lista(c.ids)}${mk ? ` <span class="tag">${t('xa.tag')}</span>` : ''}</td><td class="num">${full(c.A)}</td><td class="num">${full(c.T)}</td><td class="num">${br(c.m, 1)}</td><td class="num">${c.zeta == null ? '—' : br(c.zeta, 2)}</td>`
        + `<td>${c.ok ? `<span class="ok-t">${t(eq ? 'xa.eq' : 'xa.ok')}</span>` : '<span class="no-t">' + c.falha.join(', ') + '</span>'}</td>`
        + `<td>${mk ? '' : `<a class="lk" data-marca="${c.ids.join(',')}">${t('xa.lk')}</a>`}</td></tr>`;
    };
    const cab = s => `<tr><td colspan="7" style="padding-top:12px;border-bottom:1px solid var(--rule)"><b>${s}</b></td></tr>`;
    h += `<div class="tablewrap"><table class="t"><thead><tr><th>${t('xa.h.grp')}</th><th class="num">${SA}</th><th class="num">T*</th><th class="num">Σm</th><th class="num">ζ</th><th>${t('xa.h.res')}</th><th></th></tr></thead><tbody>`;
    if (r.topOk.length) { h += cab(t('xa.cab1')); r.topOk.slice(0, 8).forEach(c => { h += linha(c); }); }
    if (r.excluidos.length) { h += cab(t('xa.cab2')); r.excluidos.slice(0, 6).forEach(c => { h += linha(c); }); }
    $('xa').innerHTML = h + '</tbody></table></div>';
  }
  function renderPart() {
    const r = R; if (!r.n) { $('part').innerHTML = ''; return; }
    const pais = S.modo === 'pais', g = num(cfg().gamma);
    let h = `<div class="tablewrap"><table class="t"><thead><tr><th>${t('modulo')}</th><th class="num">V + γE</th><th class="num">b</th><th class="num">φ</th><th class="num">t</th>` + (pais ? `<th class="num">${t('part.h.bolsa')}</th>` : '') + '</tr></thead><tbody>';
    let sV = 0, sb = 0, sp = 0, st = 0, sti = 0;
    r.sel.slice().sort(ordId).forEach(id => {
      const md = M.mods.find(m => m.id === id), v = md.V + g * md.E;
      sV += v; sb += r.b[id]; sp += r.phi[id]; st += r.t[id]; sti += md.tit || 0;
      h += `<tr><td><b>${esc(id)}</b><span class="nm">${esc(nomeMod(md))}</span></td><td class="num">${full(v)}</td><td class="num">${full(r.b[id])}</td><td class="num">${full(r.phi[id])}</td><td class="num"><b>${full(r.t[id])}</b></td>` + (pais ? `<td class="num">${full(md.tit)}</td>` : '') + '</tr>';
    });
    h += `</tbody><tfoot><tr><td>${t('total')}</td><td class="num">${full(sV)}</td><td class="num">${full(sb)}</td><td class="num">${full(sp)}</td><td class="num">${full(st)}</td>` + (pais ? `<td class="num">${full(sti)}</td>` : '') + '</tr></tfoot></table></div>';
    h += '<p class="note">' + t('part.note', { v: full(r.v), f: full(r.f), T: full(r.T) })
      + (r.nucleoVazio ? t('part.vazio', { v: full(r.T_LP) }) : t(r.shapNucleo ? 'part.in' : 'part.out')) + '</p>';
    $('part').innerHTML = h;
  }
  function renderCas() {
    const r = R; if (!r.n) { $('cas').innerHTML = ''; return; }
    const ativos = r.fluxos.filter(f => f.q > 1e-12);
    let h = '';
    if (!ativos.length) h += `<div class="empty">${t('cas.vazio')}</div>`;
    else {
      h += `<div class="tablewrap"><table class="t"><thead><tr><th>${t('cas.h.f')}</th><th>${t('cas.h.elo')}</th><th class="num">q</th><th class="num">s = u − p</th><th class="num">ψ</th><th class="num">${t('cas.h.an')}</th><th class="num">${t('cas.h.vp')}</th><th class="c">${t('cas.h.rg')}</th></tr></thead><tbody>`;
      ativos.forEach(f => {
        h += `<tr class="${f.s > 0 ? '' : 'off'}"><td>${tx(f.tipo)}</td><td class="mono">${esc(f.de)} → ${esc(f.para)}</td><td class="num">${qf(f.q)} ${esc(f.un)}</td><td class="num">${br(f.s, f.s < 10 ? 3 : 1)}</td><td class="num">${br(f.psi, 2)}</td><td class="num">${full(f.anual)}</td><td class="num">${full(f.vp)}</td><td class="c">${f.regen ? '✓' : ''}</td></tr>`;
      });
      h += `</tbody><tfoot><tr><td colspan="6">${t('cas.foot', { v: full(r.Cs) })}</td><td class="num">${full(r.C)}</td><td></td></tr></tfoot></table></div>`;
      h += `<p class="note">${t('cas.cinza')}</p>`;
    }
    const sb = r.saidas.filter(s => s.S > 0);
    if (sb.length) {
      h += `<h3 class="h3s">${t('cas.saidas')}</h3><div class="tablewrap"><table class="t"><thead><tr><th>${t('cas.h.saida')}</th><th>${t('cas.h.forn')}</th><th class="num">${t('cas.h.of')}</th><th class="num">${t('cas.h.us')}</th><th class="num">${t('cas.h.sd')}</th></tr></thead><tbody>`;
      sb.forEach(s => { h += `<tr><td>${tx(s.tipo)}</td><td class="mono">${esc(s.de)}</td><td class="num">${qf(s.S)} ${esc(s.un)}</td><td class="num">${qf(s.usado)}</td><td class="num">${qf(s.sobra)}</td></tr>`; });
      h += '</tbody></table></div>';
    }
    h += `<p class="note">${t('cas.lamloc', { p: r.lamLoc == null ? '—' : pct(r.lamLoc) })}${r.zeta != null ? t('cas.zeta', { z: br(r.zeta, 2) }) : ''}</p>`;
    $('cas').innerHTML = h;
  }
  function renderCurva() {
    const host = $('ch-gamma'), r = R;
    if (!r || !r.n || !r.curva || $('p-local').hidden) { if (r && !r.n) host.innerHTML = ''; return; }
    Charts.curvaGamma(host, r, num(cfg().gamma), moeda());
  }

  /* ------------------------------------------------------------ tabela de módulos */
  function renderMods() {
    const c = cfg(), pais = S.modo === 'pais';
    const mods = pais ? EN.modeloPais(paisAtual(), D, S.prm, { calor: S.calor }).mods : S.local.mods;
    $('mod-sub').innerHTML = t(pais ? 'mod.sub.pais' : 'mod.sub.local');
    const ck = (id, k) => `<input type="checkbox" data-id="${esc(id)}" data-k="${k}" ${c[k].includes(id) ? 'checked' : ''} aria-label="${t('mod.h.' + k)} ${esc(id)}">`;
    let h = `<div class="tablewrap"><table class="t" id="tab-mod"><thead><tr><th class="c">${t('mod.h.sel')}</th><th class="c">${t('mod.h.busca')}</th><th class="c">${t('mod.h.obrig')}</th>`;
    if (pais) {
      h += `<th>${t('modulo')}</th><th>${t('mod.h.apl')}</th><th class="num">m</th><th class="num">TRL</th><th class="num">V</th><th class="num">E</th><th class="num">${t('mod.h.vs')}</th><th class="num">${t('part.h.bolsa')}</th></tr></thead><tbody>`;
      mods.forEach(m => {
        const ap = m.apl === 'Não' ? `<span class="tag no">${t('nao')}</span>` : m.apl === 'Condicional' ? `<span class="tag cd">${t('mod.cond')}</span>` : `<span class="tag">${t('sim')}</span>`;
        h += `<tr data-row="${m.id}" class="${m.apl === 'Não' ? 'off' : ''}"><td class="c">${ck(m.id, 'sel')}</td><td class="c">${ck(m.id, 'busca')}</td><td class="c">${ck(m.id, 'obrig')}</td>`
          + `<td><b>${m.id}</b>${m.lote ? ` <span class="tag">${t('mod.tag.lote')}</span>` : ''}<span class="nm">${esc(I.modulo(m.id, m.nome))}</span></td><td>${ap}</td><td class="num">${br(m.m, 1)}</td><td class="num">${m.TRL}</td>`
          + `<td class="num">${br(m.V)}</td><td class="num">${br(m.E)}</td><td class="num">${br(m.Vs)}</td><td class="num">${br(m.tit)}</td></tr>`;
      });
      h += '</tbody></table></div>';
      $('mod-tools').innerHTML = `<button class="btn sm" type="button" data-acao="lote">${t('mod.b.lote')}</button><button class="btn sm" type="button" data-acao="aplic">${t('mod.b.aplic')}</button><button class="btn sm" type="button" data-acao="limpa">${t('mod.b.limpa')}</button>`;
    } else {
      h += `<th>ID</th><th>${t('mod.h.nome')}</th><th class="num">V</th><th class="num">E</th><th class="num">TRL</th><th class="num">m</th><th class="num">${t('mod.h.vida')}</th><th class="num">${t('mod.h.car')}</th><th></th></tr></thead><tbody>`;
      mods.forEach((m, i) => {
        const inp = (k, cls, step) => `<input type="number" class="${cls || ''}" data-i="${i}" data-f="${k}" value="${esc(m[k])}" step="${step || 'any'}" aria-label="${k} ${esc(m.id)}">`;
        h += `<tr data-row="${esc(m.id)}"><td class="c">${ck(m.id, 'sel')}</td><td class="c">${ck(m.id, 'busca')}</td><td class="c">${ck(m.id, 'obrig')}</td>`
          + `<td><b>${esc(m.id)}</b></td><td><input type="text" class="w-l" data-i="${i}" data-f="nome" value="${esc(m.nome)}" aria-label="${t('mod.h.nome')} ${esc(m.id)}"></td>`
          + `<td>${inp('V')}</td><td>${inp('E')}</td><td>${inp('TRL', 'w-s', 1)}</td><td>${inp('m', 'w-s')}</td><td>${inp('vida', 'w-s', 1)}</td><td>${inp('car', 'w-s', 1)}</td>`
          + `<td><button class="btn ghost sm" type="button" data-del-mod="${i}" aria-label="${t('mod.rem', { id: esc(m.id) })}">✕</button></td></tr>`;
      });
      h += '</tbody></table></div>';
      $('mod-tools').innerHTML = `<button class="btn sm" type="button" data-acao="add-mod" ${mods.length >= 16 ? 'disabled' : ''}>${t('mod.b.add')}</button><button class="btn sm" type="button" data-acao="todos">${t('mod.b.todos')}</button><button class="btn sm" type="button" data-acao="limpa">${t('mod.b.limpa')}</button>`;
    }
    $('mod').innerHTML = h;
    renderFlx();
  }
  function atualizaModStatus() {
    const c = cfg();
    document.querySelectorAll('#tab-mod tr[data-row]').forEach(tr => tr.classList.toggle('on', c.sel.includes(tr.dataset.row)));
  }
  function renderFlx() {
    if (S.modo === 'pais') {
      const L = EN.linksPais(S.prm, S.calor);
      let h = `<details class="flxd"><summary class="muted">${t('flx.estudo', { n: L.length })}</summary><div class="tablewrap"><table class="t"><thead><tr><th>${t('cas.h.f')}</th><th>${t('cas.h.elo')}</th><th class="num">${t('flx.S')}</th><th class="num">${t('flx.D')}</th><th class="num">u</th><th class="num">p</th><th class="c">${t('cas.h.rg')}</th></tr></thead><tbody>`;
      L.forEach(l => { h += `<tr><td>${tx(l.tipo)}</td><td class="mono">${l.de} → ${l.para}</td><td class="num">${br(l.S, 2)} ${l.un}</td><td class="num">${br(l.D, 2)}</td><td class="num">${br(l.u, 0)}</td><td class="num">${br(l.p, 0)}</td><td class="c">${l.regen ? '✓' : ''}</td></tr>`; });
      $('flx').innerHTML = h + `</tbody></table></div><p class="note">${t('flx.fonte')}</p></details>`;
      return;
    }
    const ids = S.local.mods.map(m => m.id);
    const opt = v => ids.map(id => `<option value="${esc(id)}" ${id === v ? 'selected' : ''}>${esc(id)}</option>`).join('');
    let h = `<h3 class="h3s">${t('flx.local')}</h3><div class="tablewrap"><table class="t"><thead><tr><th>${t('cas.h.f')}</th><th>${t('flx.de')}</th><th>${t('flx.para')}</th><th class="num">${t('flx.S')}</th><th class="num">${t('flx.D')}</th><th class="num">u</th><th class="num">p</th><th>${t('flx.un')}</th><th class="c">${t('cas.h.rg')}</th><th></th></tr></thead><tbody>`;
    S.local.links.forEach((l, i) => {
      const inp = (k, ty) => `<input type="${ty || 'number'}" data-l="${i}" data-f="${k}" value="${esc(l[k])}" step="any" class="${ty ? '' : 'w-s'}" aria-label="${k}">`;
      h += `<tr><td>${inp('tipo', 'text')}</td><td><select data-l="${i}" data-f="de" aria-label="${t('flx.de')}">${opt(l.de)}</select></td><td><select data-l="${i}" data-f="para" aria-label="${t('flx.para')}">${opt(l.para)}</select></td>`
        + `<td>${inp('S')}</td><td>${inp('D')}</td><td>${inp('u')}</td><td>${inp('p')}</td><td>${inp('un', 'text')}</td><td class="c"><input type="checkbox" data-l="${i}" data-f="regen" ${l.regen ? 'checked' : ''} aria-label="${t('flx.regen')}"></td>`
        + `<td><button class="btn ghost sm" type="button" data-del-l="${i}" aria-label="${t('flx.rem')}">✕</button></td></tr>`;
    });
    h += `</tbody></table></div><div class="tools"><button class="btn sm" type="button" data-acao="add-l">${t('flx.add')}</button></div><p class="note">${t('flx.nota')}</p>`;
    $('flx').innerHTML = h;
  }

  /* ------------------------------------------------------------ controles */
  function opcoesPais() {
    const macros = [...new Set(D.paises.map(p => p.macro))];
    const lc = I.loc();
    $('sel-pais').innerHTML = macros.map(m => `<optgroup label="${esc(I.macro(m))}">` + D.paises.filter(p => p.macro === m)
      .map(p => ({ v: p.nome, n: I.pais(p.nome) })).sort((a, b) => a.n.localeCompare(b.n, lc))
      .map(o => `<option value="${esc(o.v)}">${esc(o.n)}</option>`).join('') + '</optgroup>').join('');
    $('r-macro').innerHTML = `<option value="">${t('r.todas')}</option>` + macros.map(m => `<option value="${esc(m)}">${esc(I.macro(m))}</option>`).join('');
  }
  function preencheControles() {
    const c = cfg(), pais = S.modo === 'pais';
    $('m-pais').setAttribute('aria-pressed', pais); $('m-local').setAttribute('aria-pressed', !pais);
    $('src-pais').hidden = !pais; $('src-local').hidden = pais;
    $('prm-pais').hidden = !pais; $('prm-local').hidden = pais; $('b-link').hidden = !pais;
    $('gam').value = c.gamma; $('gam-r').value = c.gamma;
    $('f-modo').value = c.Fmodo; $('m-modo').value = c.mmodo; $('t-modo').value = c.tmodo;
    $('f-val').value = c.Fval == null ? '' : c.Fval; $('m-val').value = c.mval == null ? '' : c.mval; $('t-val').value = c.tval == null ? '' : c.tval;
    $('f-val').disabled = c.Fmodo !== 'valor'; $('m-val').disabled = c.mmodo !== 'valor'; $('t-val').disabled = c.tmodo !== 'valor';
    $('f-modo').querySelector('option[value=bolsa]').textContent = t(pais ? 'f.bolsa' : 'f.ref');
    $('regen').checked = !!c.regen; $('z0').value = c.Z0 || ''; $('theta').value = c.theta;
    ['p_co2', 'p_calor', 'p_heatv', 'p_exa', 'p_glp'].forEach(k => { $(k).value = S.prm[k]; });
    $('calor').checked = S.calor;
    $('tsoc').value = pais ? S.prm.tsoc : S.local.tsoc;
    if (pais) {
      const p = paisAtual();
      $('sel-pais').value = p.nome;
      $('pais-meta').textContent = t('pais.meta', { macro: I.macro(p.macro), leitura: I.leitura(p.leitura), idh: br(p.idh, 3), taxa: pct(p.taxa, 0), W: br(p.W, 2) });
    } else {
      $('loc-nome').value = S.local.nome; $('l-taxa').value = S.local.taxa; $('l-W').value = S.local.W; $('l-moeda').value = S.local.moeda;
      $('local-meta').textContent = t('local.meta', { m: S.local.mods.length, f: S.local.links.length });
    }
  }
  function trocaModo(m) { S.modo = m; history.replaceState(null, '', m === 'pais' ? '#pais=' + encodeURIComponent(S.pais) : '#local'); preencheControles(); renderMods(); calcular(); }

  $('m-pais').addEventListener('click', () => trocaModo('pais'));
  $('m-local').addEventListener('click', () => trocaModo('local'));
  $('sel-pais').addEventListener('change', e => { abrirPais(e.target.value); history.replaceState(null, '', '#pais=' + encodeURIComponent(S.pais)); preencheControles(); renderMods(); calcular(); });
  $('b-lote').addEventListener('click', () => { abrirPais(S.pais); renderMods(); calcular(); });
  $('b-editar').addEventListener('click', () => {
    const md = EN.modeloPais(paisAtual(), D, S.prm, { calor: S.calor });
    S.local = { nome: t('local.copia', { p: I.pais(S.pais) }), moeda: 'USD', taxa: md.taxa, tsoc: S.prm.tsoc, W: md.W,
      mods: md.mods.map(m => ({ id: m.id, nome: I.modulo(m.id, m.nome), V: Math.round(m.V), E: Math.round(m.E), TRL: m.TRL, m: m.m, vida: m.vida, car: m.car, apl: m.apl, tit: Math.round(m.tit) })),
      links: md.links.map(l => Object.assign({}, l, { tipo: I.fluxo(l.tipo) })), cfg: JSON.parse(JSON.stringify(S.cfgPais)) };
    trocaModo('local');
  });
  $('loc-nome').addEventListener('input', e => { S.local.nome = e.target.value; agenda(); });
  $('loc-preset').addEventListener('change', e => {
    const v = e.target.value; e.target.value = '';
    if (!v) return;
    S.local = v === 'garuva' ? ST.garuva() : ST.branco(); preencheControles(); renderMods(); calcular();
  });
  $('b-exp').addEventListener('click', () => baixar((S.local.nome || 'local').replace(/[^\w\-]+/g, '_') + '.json', JSON.stringify(S.local, null, 1), 'application/json'));
  $('f-imp').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const L = JSON.parse(rd.result);
        if (!Array.isArray(L.mods) || !Array.isArray(L.links)) throw new Error(t('imp.semmods'));
        L.cfg = Object.assign({}, ST.CFG0, L.cfg || {}); if (!L.cfg.sel.length) L.cfg.sel = L.mods.map(m => m.id); if (!L.cfg.busca.length) L.cfg.busca = L.mods.map(m => m.id);
        S.local = Object.assign({ nome: t('local.import'), moeda: 'R$ mil', taxa: 0.1, tsoc: 0.06, W: 1 }, L);
        preencheControles(); renderMods(); calcular();
      } catch (err) { $('local-meta').textContent = t('imp.erro', { e: err.message }); }
    };
    rd.readAsText(f); e.target.value = '';
  });

  const liga = (id, fn, ev) => $(id).addEventListener(ev || 'input', e => { fn(e.target); agenda(); });
  liga('gam', el => { const v = Math.min(1, Math.max(0, num(el.value))); cfg().gamma = v; $('gam-r').value = v; });
  liga('gam-r', el => { cfg().gamma = num(el.value); $('gam').value = el.value; });
  liga('f-modo', el => { cfg().Fmodo = el.value; if (el.value === 'valor' && cfg().Fval == null && R && R.T != null) cfg().Fval = Math.round(R.T * 100) / 100; preencheControles(); }, 'change');
  liga('m-modo', el => { cfg().mmodo = el.value; if (el.value === 'valor' && cfg().mval == null && R) cfg().mval = R.m; preencheControles(); }, 'change');
  liga('t-modo', el => { cfg().tmodo = el.value; if (el.value === 'valor' && cfg().tval == null) cfg().tval = Math.max(1, cfg().sel.length); preencheControles(); }, 'change');
  liga('f-val', el => { cfg().Fval = num(el.value); });
  liga('m-val', el => { cfg().mval = num(el.value); });
  liga('t-val', el => { cfg().tval = num(el.value, 1); });
  liga('regen', el => { cfg().regen = el.checked; }, 'change');
  liga('z0', el => { cfg().Z0 = Math.max(0, num(el.value)); });
  liga('theta', el => { cfg().theta = Math.max(0.01, num(el.value, 1)); });
  ['p_co2', 'p_calor', 'p_heatv', 'p_exa', 'p_glp'].forEach(k => liga(k, el => { S.prm[k] = Math.max(0, num(el.value)); renderModsSoft(); }));
  liga('calor', el => { S.calor = el.checked; renderFlx(); }, 'change');
  liga('tsoc', el => { if (S.modo === 'pais') { S.prm.tsoc = Math.max(0, num(el.value)); renderModsSoft(); } else S.local.tsoc = Math.max(0, num(el.value)); });
  liga('l-taxa', el => { S.local.taxa = Math.max(0, num(el.value)); });
  liga('l-W', el => { S.local.W = Math.max(0, num(el.value, 1)); });
  liga('l-moeda', el => { S.local.moeda = el.value || 'R$ mil'; });
  $('b-padrao').addEventListener('click', () => {
    if (S.modo === 'pais') { Object.assign(S.prm, ST.PRM0); S.calor = false; Object.assign(S.cfgPais, { gamma: 0, Fmodo: 'tstar', Fval: null, mmodo: 'sel', mval: null, tmodo: 'sel', tval: null, regen: false, Z0: 0, theta: 1 }); }
    else Object.assign(S.local.cfg, { gamma: 0, theta: 1 });
    preencheControles(); renderMods(); calcular();
  });
  let rmT = null;
  function renderModsSoft() { clearTimeout(rmT); rmT = setTimeout(() => { const y = window.scrollY; renderMods(); atualizaModStatus(); window.scrollTo(0, y); }, 250); }

  $('mod').addEventListener('change', e => {
    const el = e.target; if (!el.dataset.k) return;
    const arr = cfg()[el.dataset.k], id = el.dataset.id, i = arr.indexOf(id);
    if (el.checked && i < 0) arr.push(id); if (!el.checked && i >= 0) arr.splice(i, 1);
    calcular();
  });
  $('mod').addEventListener('input', e => {
    const el = e.target; if (el.dataset.i == null) return;
    S.local.mods[+el.dataset.i][el.dataset.f] = el.value; agenda();
  });
  $('mod').addEventListener('click', e => {
    const b = e.target.closest('[data-del-mod]'); if (!b) return;
    const m = S.local.mods.splice(+b.dataset.delMod, 1)[0], c = S.local.cfg;
    ['sel', 'busca', 'obrig'].forEach(k => { c[k] = c[k].filter(x => x !== m.id); });
    S.local.links = S.local.links.filter(l => l.de !== m.id && l.para !== m.id);
    renderMods(); calcular();
  });
  $('mod-tools').addEventListener('click', e => {
    const a = e.target.dataset.acao; if (!a) return; const c = cfg();
    if (a === 'lote') abrirPais(S.pais);
    if (a === 'aplic') c.sel = paisAtual().mods.filter(m => m.apl !== 'Não').map(m => m.id);
    if (a === 'todos') c.sel = S.local.mods.map(m => m.id);
    if (a === 'limpa') c.sel = [];
    if (a === 'add-mod') {
      let n = 1; const ids = new Set(S.local.mods.map(m => m.id)); while (ids.has('L' + n)) n++;
      const id = 'L' + n; S.local.mods.push({ id, nome: t('mod.novo', { n }), V: 0, E: 0, TRL: 9, m: 0, vida: 10, car: 0, apl: 'Sim', tit: 0 });
      c.sel.push(id); c.busca.push(id);
    }
    renderMods(); calcular();
  });
  const editaFlx = (e, imediato) => {
    const el = e.target; if (el.dataset.l == null) return;
    S.local.links[+el.dataset.l][el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
    if (imediato) calcular(); else agenda();
  };
  $('flx').addEventListener('input', e => editaFlx(e, false));
  $('flx').addEventListener('change', e => editaFlx(e, true));
  $('flx').addEventListener('click', e => {
    const d = e.target.closest('[data-del-l]');
    if (d) { S.local.links.splice(+d.dataset.delL, 1); renderFlx(); calcular(); return; }
    if (e.target.dataset.acao === 'add-l') {
      const ids = S.local.mods.map(m => m.id);
      S.local.links.push({ tipo: t('fluxo'), de: ids[0] || '', para: ids[1] || ids[0] || '', S: 0, D: 0, u: 0, p: 0, un: 't/a', regen: false });
      renderFlx(); calcular();
    }
  });
  document.addEventListener('click', e => {
    const m = e.target.closest('[data-marca]'); if (!m) return;
    cfg().sel = m.dataset.marca.split(','); renderMods(); calcular();
    $('kpis').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ------------------------------------------------------------ exportações */
  function baixar(nome, txt, tipo) {
    const b = new Blob([txt], { type: tipo + ';charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const csv = rows => {
    const en = I.lang() === 'en', sep = en ? ',' : ';';
    const cell = v => { const s = typeof v === 'number' ? String(Math.round(v * 1000) / 1000).replace('.', en ? '.' : ',') : String(v == null ? '' : v); return new RegExp('[' + sep + '"\\n]').test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + rows.map(r => r.map(cell).join(sep)).join('\n');
  };
  $('b-csv').addEventListener('click', () => {
    if (!R || !R.n) return;
    const nome = S.modo === 'pais' ? I.pais(S.pais) : S.local.nome, rows = [];
    rows.push([t('sim.doctitle'), nome, t('csv.moeda') + ': ' + moeda()]); rows.push([]);
    rows.push([t('xa.h.grp'), lista(R.sel)]); rows.push([t('csv.A'), R.A]); rows.push([t('csv.Cp'), R.C]); rows.push([t('csv.Cs'), R.Cs]);
    rows.push(['v(N)', R.v]); rows.push(['f(N)', R.f]); rows.push(['T*', R.T]); rows.push([t('csv.F'), R.F]); rows.push(['E^N', R.E_N]); rows.push(['lambda_T', R.lamT]); rows.push(['gamma*', R.gStar]); rows.push([t('csv.g'), R.gamma]);
    rows.push([t('xa.eq'), R.xA ? lista(R.xA.ids) : t('nenhum')]); rows.push([t('csv.xaA'), R.xA ? R.xA.A : '']); rows.push([t('csv.xaT'), R.xA ? R.xA.T : '']); rows.push([]);
    rows.push([t('modulo'), 'V', 'E', 'b', 'phi', 't']);
    R.sel.slice().sort(ordId).forEach(id => { const md = M.mods.find(m => m.id === id); rows.push([id, md.V, md.E, R.b[id], R.phi[id], R.t[id]]); });
    rows.push([]); rows.push([t('cas.h.f'), t('flx.de'), t('flx.para'), 'q', t('flx.un'), 's', 'psi', t('cas.h.an'), t('cas.h.vp')]);
    R.fluxos.forEach(f => rows.push([I.fluxo(f.tipo), f.de, f.para, f.q, f.un, f.s, f.psi, f.anual, f.vp]));
    rows.push([]); rows.push([t('xa.h.grp'), 'A', 'T*', 'Σm', 'zeta', t('xa.ok'), t('csv.falhas')]);
    R.top.forEach(c => rows.push([lista(c.ids), c.A, c.T, c.m, c.zeta == null ? '' : c.zeta, c.ok ? t('sim') : t('nao'), c.falha.join(', ')]));
    baixar('equilibrio_azul_' + nome.replace(/[^\w\-]+/g, '_') + '.csv', csv(rows), 'text/csv');
  });
  $('b-link').addEventListener('click', () => {
    const url = location.href.split('#')[0] + '#pais=' + encodeURIComponent(S.pais);
    const ok = () => { $('b-link').textContent = t('b.link.ok'); setTimeout(() => { $('b-link').textContent = t('b.link'); }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, () => { history.replaceState(null, '', url); });
    else history.replaceState(null, '', url);
  });

  /* ------------------------------------------------------------ ranking */
  let RK = null, rkChave = '', rkSort = { col: 'T', dir: 'desc' };
  const chaveRk = () => JSON.stringify([S.prm, S.calor, S.cfgPais.gamma]);
  function calcRanking() {
    const ch = chaveRk(); if (RK && ch === rkChave) { renderRanking(); return; }
    rkChave = ch; RK = []; const bar = $('r-prog').firstElementChild; let i = 0;
    const passo = () => {
      const t0 = performance.now();
      while (i < D.paises.length && performance.now() - t0 < 30) {
        const p = D.paises[i++], md = EN.modeloPais(p, D, S.prm, { calor: S.calor }), lp = ST.lotePais(p);
        const r = EN.avaliar(md, { gamma: S.cfgPais.gamma, sel: lp.sel, universo: lp.busca, obrig: lp.obrig, maxTam: lp.sel.length, nucleo: false, curva: false, top: 1 });
        RK.push({ pais: p.nome, macro: p.macro, lote: lista(lp.sel), tit: r.tit, T: r.T, dif: r.T - r.tit, A: r.A, EN: r.E_N, lamT: r.lamT, g: r.gStar,
                  xA: r.xA && !r.igual ? lista(r.xA.ids) : '', ganho: r.xA && !r.igual ? r.xA.A - r.A : 0, TxA: r.xA ? r.xA.T : null, igual: r.igual });
      }
      bar.style.width = (100 * i / D.paises.length) + '%'; bar.parentElement.style.visibility = 'visible';
      if (i < D.paises.length) setTimeout(passo, 0); else { bar.parentElement.style.visibility = 'hidden'; renderRanking(); }
    };
    passo();
  }
  function renderRanking() {
    if (!RK || RK.length < D.paises.length) return;
    const mc = $('r-macro').value, q = $('r-busca').value.trim().toLowerCase(), so = $('r-dif').checked;
    const rows = RK.filter(r => (!mc || r.macro === mc) && (!q || r.pais.toLowerCase().includes(q) || I.pais(r.pais).toLowerCase().includes(q)) && (!so || !r.igual));
    const k = rkSort.col, d = rkSort.dir === 'asc' ? 1 : -1, lc = I.loc();
    rows.sort((a, b) => {
      if (k === 'pais') return d * I.pais(a.pais).localeCompare(I.pais(b.pais), lc);
      const x = a[k], y = b[k]; if (typeof x === 'string') return d * x.localeCompare(y, lc);
      return d * (((x == null) ? -Infinity : x) - ((y == null) ? -Infinity : y));
    });
    const sT = RK.reduce((s, r) => s + r.T, 0), sB = RK.reduce((s, r) => s + r.tit, 0), sA = RK.reduce((s, r) => s + r.A, 0), sG = RK.reduce((s, r) => s + r.ganho, 0);
    const mi = v => br(v / 1e6, 2) + ' ' + t('u.mi');
    $('r-kpis').innerHTML = kpi(t('r.k.T'), mi(sT), t('kpi.T.bolsa', { v: mi(sB) }) + ' (' + (sT >= sB ? '+' : '') + pct((sT - sB) / sB, 1) + ')')
      + kpi(t('kpi.A') + ' ' + SA, mi(sA), t('kpi.A.ft', { u: 'USD' })) + kpi(t('r.k.eq'), t('r.k.eq.v', { a: RK.filter(r => r.igual).length, b: RK.length }), t('r.k.eq.ft'))
      + kpi(t('r.k.ganho'), mi(sG), t('r.k.ganho.ft')) + kpi(t('r.k.g'), br(S.cfgPais.gamma, 2), t('r.k.g.ft', { p: br(S.prm.p_co2), c: S.calor ? t('r.k.calor') : '' }));
    const cols = [['pais', t('pais'), 0], ['lote', t('lote'), 0], ['tit', t('r.h.tit'), 1], ['T', 'T*', 1], ['dif', t('r.h.dif'), 1], ['A', SA, 1], ['EN', 'E<sup>N</sup>', 1], ['lamT', 'λ<sub>T</sub>', 1], ['g', 'γ*', 1], ['xA', t('col.eq'), 0], ['ganho', t('r.h.ganho') + ' ' + SA, 1]];
    let h = '<div class="tablewrap"><table class="t"><thead><tr>' + cols.map(c => `<th class="sort ${c[2] ? 'num' : ''}" data-col="${c[0]}" ${k === c[0] ? `data-dir="${rkSort.dir}"` : ''}>${c[1]}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach(r => {
      h += `<tr><td><a class="lk" data-abre="${esc(r.pais)}">${esc(I.pais(r.pais))}</a><span class="nm">${esc(I.macro(r.macro))}</span></td><td class="mono">${r.lote}</td><td class="num">${br(r.tit)}</td><td class="num">${br(r.T)}</td><td class="num">${br(r.dif)}</td><td class="num">${br(r.A)}</td>`
        + `<td class="num">${pct(r.EN)}</td><td class="num">${r.lamT == null ? '—' : br(r.lamT, 1)}</td><td class="num">${r.g == null ? '—' : br(r.g, 2)}</td><td class="mono">${r.xA || `<span class="muted">${t('r.proprio')}</span>`}</td><td class="num">${r.ganho ? br(r.ganho) : ''}</td></tr>`;
    });
    $('r-tab').innerHTML = h + `</tbody></table></div><p class="note">${t('r.nota', { a: rows.length, b: RK.length })}</p>`;
  }
  ['r-macro', 'r-dif'].forEach(id => $(id).addEventListener('change', renderRanking));
  $('r-busca').addEventListener('input', renderRanking);
  $('r-tab').addEventListener('click', e => {
    const th = e.target.closest('th[data-col]');
    if (th) { const c = th.dataset.col; rkSort = { col: c, dir: rkSort.col === c && rkSort.dir === 'desc' ? 'asc' : 'desc' }; renderRanking(); return; }
    const a = e.target.closest('[data-abre]');
    if (a) { abrirPais(a.dataset.abre); abaSel('t-local'); trocaModo('pais'); window.scrollTo(0, 0); }
  });
  $('r-csv').addEventListener('click', () => {
    if (!RK) return;
    const rows = [[t('pais'), t('macro'), t('lote'), t('r.h.tit') + ' (USD)', 'T* (USD)', t('r.h.dif') + ' (USD)', 'A (USD)', 'E^N', 'lambda_T', 'gamma*', t('col.eq'), t('r.h.ganho') + ' A (USD)']];
    RK.forEach(r => rows.push([I.pais(r.pais), I.macro(r.macro), r.lote, r.tit, r.T, r.dif, r.A, r.EN, r.lamT, r.g, r.xA || t('r.proprio'), r.ganho]));
    baixar('ranking_equilibrio_azul.csv', csv(rows), 'text/csv');
  });

  /* ------------------------------------------------------------ abas, idioma e tema */
  const abas = ['t-local', 't-rank', 't-uso'];
  function abaSel(id) {
    abas.forEach(a => { const on = a === id; $(a).setAttribute('aria-selected', on); $(a.replace('t-', 'p-')).hidden = !on; });
    if (id === 't-rank') calcRanking();
    if (id === 't-local') setTimeout(renderCurva, 0);
    const hs = { 't-rank': '#ranking', 't-uso': '#uso' }[id];
    if (hs) history.replaceState(null, '', hs); else if (/^#(ranking|uso)$/.test(location.hash)) history.replaceState(null, '', '#pais=' + encodeURIComponent(S.pais));
  }
  abas.forEach(a => $(a).addEventListener('click', () => abaSel(a)));
  $('t-local').parentElement.addEventListener('keydown', e => {
    const i = abas.indexOf(document.activeElement.id); if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const j = (i + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length; $(abas[j]).focus(); abaSel(abas[j]); }
  });
  document.addEventListener('ea-lang', () => {
    opcoesPais(); preencheControles(); renderMods(); render();
    if (!$('p-rank').hidden) renderRanking();
  });
  document.addEventListener('ea-tema', () => setTimeout(renderCurva, 0));
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastW) > 30) { lastW = window.innerWidth; clearTimeout(rmT); rmT = setTimeout(renderCurva, 150); } });

  /* ------------------------------------------------------------ início */
  try { if (window.matchMedia('(max-width: 1100px)').matches) $('prm-det').open = false; } catch (e) { /* navegador antigo */ }
  opcoesPais(); preencheControles(); renderMods(); calcular();
  if (h0 === 'ranking') abaSel('t-rank'); else if (h0 === 'uso') abaSel('t-uso');
  window.__pronto = true;
})();
