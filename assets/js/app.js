/* Simulador do Equilíbrio Azul — interface. O cálculo está em engine.js. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = window.DADOS, EN = window.Engine, SYM = window.SYM || {};
  const SA = `<span class="inl">${SYM.A || '𝒜'}</span>`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const br = (v, d = 0) => (v == null || !isFinite(v)) ? '—' : (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v, d = 0) => (v == null || !isFinite(v)) ? '—' : br(v * 100, d) + '%';
  const num = (v, d = 0) => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : d; };
  const ordId = (a, b) => { const pa = a.match(/^(\D*)(\d*)$/) || [a, a, ''], pb = b.match(/^(\D*)(\d*)$/) || [b, b, '']; return pa[1] === pb[1] ? (+pa[2] || 0) - (+pb[2] || 0) : (pa[1] < pb[1] ? -1 : 1); };
  const lista = ids => ids.slice().sort(ordId).join(', ');
  const tx = s => esc(String(s == null ? '' : s).replace(/CO2/g, 'CO₂'));
  const qf = v => br(v, Math.abs(v) < 100 && Math.abs(v - Math.round(v)) > 1e-9 ? 2 : 0);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* armazenamento indisponível */ } }
  };
  const PRM0 = { p_co2: 335, p_calor: 20, p_heatv: 15, p_exa: 15, p_glp: 90, tsoc: 0.06 };
  const CFG0 = { gamma: 0, sel: [], busca: [], obrig: [], Fmodo: 'tstar', Fval: null, mmodo: 'sel', mval: null, tmodo: 'sel', tval: null, regen: false, Z0: 0, theta: 1 };

  function garuva() {
    return {
      nome: 'Biossistema de Garuva (SC), ilustrativo', moeda: 'R$ mil', taxa: 0.10, tsoc: 0.10, W: 1,
      mods: [
        { id: 'G1', nome: 'Biodigestor e gerador', V: 150, E: 200, TRL: 9, m: 2, vida: 10, car: 0, apl: 'Sim', tit: 0 },
        { id: 'G2', nome: 'Microalgas', V: -300, E: 90, TRL: 6, m: 1, vida: 10, car: 0, apl: 'Sim', tit: 0 },
        { id: 'G3', nome: 'Piscicultura (tilápia)', V: -40, E: 70, TRL: 9, m: 4, vida: 10, car: 0, apl: 'Sim', tit: 0 },
        { id: 'G4', nome: 'Fertirrigação com digestato', V: -20, E: 30, TRL: 9, m: 3, vida: 10, car: 0, apl: 'Sim', tit: 0 },
      ],
      links: [
        { tipo: 'CO₂', de: 'G1', para: 'G2', S: 56, D: 22, u: 1.8, p: 0, un: 't/a', regen: false },
        { tipo: 'digestato', de: 'G1', para: 'G2', S: 2500, D: 350, u: 0.015, p: 0, un: 'm³/a', regen: true },
        { tipo: 'digestato', de: 'G1', para: 'G4', S: 2500, D: 1500, u: 0.015, p: 0, un: 'm³/a', regen: true },
        { tipo: 'microalgas', de: 'G2', para: 'G3', S: 12, D: 10, u: 4, p: 1, un: 't/a', regen: false },
      ],
      cfg: Object.assign({}, CFG0, { sel: ['G1', 'G2', 'G3', 'G4'], busca: ['G1', 'G2', 'G3', 'G4'], Fmodo: 'valor', Fval: 35, mmodo: 'valor', mval: 6, tmodo: 'livre', regen: true, Z0: 2500, theta: 1 }),
    };
  }
  function branco() {
    return {
      nome: 'Local novo', moeda: 'R$ mil', taxa: 0.10, tsoc: 0.06, W: 1,
      mods: [{ id: 'L1', nome: 'Módulo 1', V: 0, E: 0, TRL: 9, m: 0, vida: 10, car: 0, apl: 'Sim', tit: 0 },
             { id: 'L2', nome: 'Módulo 2', V: 0, E: 0, TRL: 9, m: 0, vida: 10, car: 0, apl: 'Sim', tit: 0 }],
      links: [], cfg: Object.assign({}, CFG0, { sel: ['L1', 'L2'], busca: ['L1', 'L2'], tmodo: 'livre' }),
    };
  }

  /* ------------------------------------------------------------ estado */
  const salvo = LS.get('ea-estado', null);
  const S = {
    modo: 'pais', pais: 'Etiópia', prm: Object.assign({}, PRM0), calor: false,
    cfgPais: Object.assign({}, CFG0), local: garuva(),
  };
  if (salvo && typeof salvo === 'object') {
    try {
      if (salvo.prm) Object.assign(S.prm, salvo.prm);
      S.calor = !!salvo.calor;
      if (salvo.local && Array.isArray(salvo.local.mods)) { S.local = salvo.local; S.local.cfg = Object.assign({}, CFG0, S.local.cfg || {}); }
      if (salvo.cfgPais) ['gamma', 'Fmodo', 'Fval', 'mmodo', 'mval', 'tmodo', 'tval', 'regen', 'Z0', 'theta'].forEach(k => { if (k in salvo.cfgPais) S.cfgPais[k] = salvo.cfgPais[k]; });
      if (salvo.pais && D.paises.some(p => p.nome === salvo.pais)) S.pais = salvo.pais;
      if (salvo.modo === 'local') S.modo = 'local';
    } catch (e) { /* estado antigo inválido: segue com o padrão */ }
  }
  const h = decodeURIComponent((location.hash || '').slice(1));
  if (h.startsWith('pais=')) { const n = h.slice(5); if (D.paises.some(p => p.nome === n)) { S.pais = n; S.modo = 'pais'; } }
  else if (h === 'local') S.modo = 'local';
  const salvar = () => LS.set('ea-estado', { modo: S.modo, pais: S.pais, prm: S.prm, calor: S.calor, cfgPais: S.cfgPais, local: S.local });
  const cfg = () => (S.modo === 'pais' ? S.cfgPais : S.local.cfg);
  const paisAtual = () => D.paises.find(p => p.nome === S.pais);

  function lotePais(p) {
    const lote = p.mods.filter(m => m.lote).map(m => m.id).sort(ordId);
    const need13 = lote.includes('M13');
    const busca = p.mods.filter(m => m.apl !== 'Não' && m.id !== 'M13').map(m => m.id).concat(need13 ? ['M13'] : []);
    return { sel: lote, busca, obrig: need13 ? ['M13'] : [] };
  }
  function abrirPais(nome) {
    S.pais = nome; const p = paisAtual(); Object.assign(S.cfgPais, lotePais(p));
  }
  if (!S.cfgPais.sel.length) abrirPais(S.pais);

  /* ------------------------------------------------------------ modelo */
  function modelo() {
    if (S.modo === 'pais') return EN.modeloPais(paisAtual(), D, S.prm, { calor: S.calor });
    const L = S.local, ids = new Set();
    const mods = L.mods.filter(m => { if (!m.id || ids.has(m.id)) return false; ids.add(m.id); return true; }).map(m => {
      const V = num(m.V), E = num(m.E);
      return { id: m.id, nome: m.nome || m.id, V, E, Vs: V + E, TRL: Math.min(9, Math.max(1, Math.round(num(m.TRL, 9)))), m: num(m.m), vida: Math.max(1, Math.round(num(m.vida, 10))),
               car: Math.max(0, Math.round(num(m.car))), apl: m.apl || 'Sim', tit: num(m.tit) };
    });
    const links = L.links.filter(l => ids.has(l.de) && ids.has(l.para) && l.de !== l.para)
      .map(l => ({ tipo: l.tipo || 'fluxo', de: l.de, para: l.para, S: num(l.S), D: num(l.D), u: num(l.u), p: num(l.p), un: l.un || '', regen: !!l.regen }));
    return { nome: L.nome, tipo: 'local', moeda: L.moeda || 'R$ mil', taxa: num(L.taxa, 0.1), tsoc: num(L.tsoc, 0.06), W: Math.max(0, num(L.W, 1)), mods, links };
  }

  let M = null, R = null; // modelo e resultado correntes
  const moeda = () => (M ? M.moeda : 'USD');
  function money(v, longo) {
    if (v == null || !isFinite(v)) return '—';
    const u = moeda();
    if (/mil/i.test(u)) return br(v, Math.abs(v) >= 1000 ? 0 : 1) + (longo ? ' ' + u : '');
    const a = Math.abs(v);
    if (a >= 1e6) return br(v / 1e6, 2) + ' mi' + (longo ? ' ' + u : '');
    if (a >= 1e4) return br(v / 1e3, 0) + ' mil' + (longo ? ' ' + u : '');
    return br(v, 0) + (longo ? ' ' + u : '');
  }
  const full = v => (/mil/i.test(moeda()) ? br(v, 1) : br(v, 0));

  /* ------------------------------------------------------------ cálculo */
  function calcular() {
    M = modelo();
    const c = cfg(), ids = M.mods.map(m => m.id);
    const sel = c.sel.filter(id => ids.includes(id)), busca = c.busca.filter(id => ids.includes(id)), obrig = c.obrig.filter(id => ids.includes(id));
    const tit = M.mods.filter(m => sel.includes(m.id)).reduce((s, m) => s + (m.tit || 0), 0);
    const F = c.Fmodo === 'tstar' ? null : c.Fmodo === 'bolsa' ? tit : num(c.Fval);
    const mbar = c.mmodo === 'sel' ? null : num(c.mval);
    const maxTam = c.tmodo === 'sel' ? Math.max(1, sel.length) : c.tmodo === 'livre' ? 99 : Math.max(1, Math.round(num(c.tval, 1)));
    const Z0 = Math.max(0, num(c.Z0));
    try {
      R = EN.avaliar(M, { gamma: Math.min(1, Math.max(0, num(c.gamma))), sel, universo: busca, obrig, maxTam, F, mbar, theta: Math.max(0.01, num(c.theta, 1)), Z0, regen: !!c.regen && Z0 > 0, top: 12 });
      R.regenAplicada = !!c.regen && Z0 > 0;
    } catch (e) { R = { erro: e.message }; }
    render(); salvar();
    if (S.modo === 'local') $('local-meta').textContent = `${S.local.mods.length} módulos · ${S.local.links.length} fluxos · salvo neste navegador`;
    if (!R.erro) { $('f-val').placeholder = br(R.F, /mil/i.test(moeda()) ? 1 : 0); $('m-val').placeholder = br(R.mbar, 1); $('t-val').placeholder = String(maxTam > 16 ? '—' : maxTam); }
  }
  let tmr = null;
  const agenda = () => { clearTimeout(tmr); tmr = setTimeout(calcular, 70); };

  /* ------------------------------------------------------------ resultados */
  function render() {
    if (R.erro) { $('kpis').innerHTML = ''; $('chips').innerHTML = ''; $('leitura').textContent = R.erro; return; }
    renderKPIs(); renderChips(); renderLeitura(); renderXA(); renderPart(); renderCas(); renderCurva(); atualizaModStatus();
  }
  function kpi(lb, v, ft) { return `<div class="kpi"><span class="lb">${lb}</span><b>${v}</b><span class="ft">${ft || ''}</span></div>`; }
  function renderKPIs() {
    const r = R, pais = S.modo === 'pais';
    const gtxt = r.gStar == null ? (r.n ? 'não zera com γ ≤ 1' : '') : r.gStar === 0 ? 'não precisa de doação' : 'dispensa a doação';
    $('kpis').innerHTML = !r.n ? kpi('Valor azul ' + SA, '—', 'marque ao menos um módulo') : [
      kpi('Valor azul ' + SA, money(r.A), 'VPL social + cascata, ' + moeda()),
      kpi('Título social T*', money(r.T), pais ? 'Bolsa Azul: ' + money(r.tit) : 'sem cascata: ' + money(r.deficits)),
      kpi('E<sup>N</sup> sem coordenação', pct(r.E_N), r.xN.length ? 'só ' + lista(r.xN) : 'nenhum módulo se paga'),
      kpi('λ<sub>T</sub>', r.lamT == null ? '—' : br(r.lamT, 1), 'de valor azul por 1 de título'),
      kpi('γ*', r.gStar == null ? '—' : br(r.gStar, 2), gtxt),
    ].join('');
  }
  function chip(cls, txt) { return `<span class="chip ${cls}"><i>${cls === 'ok' ? '✓' : cls === 'no' ? '✕' : '!'}</i>${txt}</span>`; }
  function renderChips() {
    const r = R; if (!r.n) { $('chips').innerHTML = ''; return; }
    const c = [];
    c.push(chip(r.lancavel ? 'ok' : 'no', `Doação: T* ${r.lancavel ? '≤' : '>'} F = ${money(r.F)}`));
    c.push(chip(r.m >= r.mbar - 1e-9 ? 'ok' : 'no', `Necessidades básicas: Σm = ${br(r.m, 1)} ${r.m >= r.mbar - 1e-9 ? '≥' : '<'} m̄ = ${br(r.mbar, 1)}`));
    if (R.regenAplicada) c.push(chip(r.zeta >= r.limZ - 1e-12 ? 'ok' : 'no', `Regeneração: ζ = ${br(r.zeta, 2)} ${r.zeta >= r.limZ - 1e-12 ? '≥' : '<'} ${br(r.limZ, 2)}`));
    else c.push(chip('wn', 'Regeneração não aplicada (informe Z₀)'));
    if (r.nucleoVazio) c.push(chip('no', `Núcleo vazio: estabilidade exige ${money(r.T_LP)}`));
    else c.push(chip('ok', 'Núcleo não vazio' + (r.shapNucleo ? '; Shapley no núcleo' : '; Shapley fora do núcleo')));
    c.push(chip(r.igual ? 'ok' : 'wn', r.igual ? 'O marcado já é o equilíbrio azul' : (r.xA ? 'Há agrupamento melhor' : 'Nenhum agrupamento atende tudo')));
    $('chips').innerHTML = c.join('');
  }
  function renderLeitura() {
    const r = R;
    if (!r.n) { $('leitura').innerHTML = 'Marque na tabela de módulos o que o local vai construir.'; return; }
    const nome = S.modo === 'pais' ? S.pais : (S.local.nome || 'o local');
    let t = `${esc(nome)}: o agrupamento <b>${lista(r.sel)}</b> vale <b>${money(r.A, true)}</b> de valor azul`;
    t += r.Cs > 1e-9 ? `, dos quais ${money(r.Cs, true)} vêm da cascata ZERI. ` : '. ';
    if (r.T <= 1e-6) t += 'Não precisa de doação: construir todos já é a melhor escolha olhando o caixa. ';
    else {
      t += `Para ficar de pé, precisa de <b>${money(r.T, true)}</b> de título social`;
      t += S.modo === 'pais' ? ` (a soma dos títulos da Bolsa Azul é ${money(r.tit, true)}). ` : ` (sem a cascata, os déficits somariam ${money(r.deficits, true)}). `;
      t += r.xN.length ? `Sem coordenação nem doação, só ${lista(r.xN)} seria construído, com ${pct(r.E_N)} do valor azul` : 'Sem coordenação nem doação, nenhum módulo seria construído';
      t += r.lamT != null ? `; cada unidade de título acrescenta ${br(r.lamT, 1)} de valor azul. ` : '. ';
    }
    if (r.igual) t += 'Com a mesma doação e as mesmas restrições, o agrupamento marcado já é o equilíbrio azul.';
    else if (r.xA) t += `Com a doação de ${money(r.F, true)}, o equilíbrio azul é <b>${lista(r.xA.ids)}</b>, com ${money(r.xA.A, true)} de valor azul e título de ${money(r.xA.T, true)}.`;
    else t += 'Nenhum agrupamento atende a todas as restrições: aumente a doação ou reveja m̄ e a regeneração.';
    $('leitura').innerHTML = t;
  }
  function renderXA() {
    const r = R, x = r.xA;
    let h = '';
    if (x) {
      const dA = x.A - r.A, dT = x.T - r.T;
      h += `<div class="xa"><div><div class="grp">${lista(x.ids)}</div><div class="d">${SA} = ${money(x.A, true)} · T* = ${money(x.T, true)} · Σm = ${br(x.m, 1)}${x.zeta != null ? ' · ζ = ' + br(x.zeta, 2) : ''}`
        + (r.igual ? ' · é o agrupamento marcado' : ` · em relação ao marcado: ${dA >= 0 ? '+' : ''}${money(dA)} de valor azul, ${dT >= 0 ? '+' : ''}${money(dT)} de título`) + '</div></div>'
        + (r.igual ? '' : `<button class="btn pri sm" type="button" data-marca="${x.ids.join(',')}">Marcar este agrupamento</button>`) + '</div>';
    } else h += '<div class="empty">Nenhum agrupamento atende a todas as restrições com a doação disponível.</div>';
    h += `<p class="note">${r.nViaveis} de ${r.nCand} agrupamentos atendem às restrições (F = ${money(r.F, true)}, m̄ = ${br(r.mbar, 1)}${R.regenAplicada ? ', ζ ≥ ' + br(r.limZ, 2) : ''}).</p>`;
    const linha = (c, grupo) => {
      const eq = x && c.mask === x.mask, mk = c.ids.slice().sort(ordId).join(',') === r.sel.slice().sort(ordId).join(',');
      return `<tr class="${eq ? 'on' : ''}"><td class="mono">${lista(c.ids)}${mk ? ' <span class="tag">marcado</span>' : ''}</td><td class="num">${full(c.A)}</td><td class="num">${full(c.T)}</td><td class="num">${br(c.m, 1)}</td><td class="num">${c.zeta == null ? '—' : br(c.zeta, 2)}</td>`
        + `<td>${c.ok ? (eq ? '<span class="ok-t">equilíbrio azul</span>' : '<span class="ok-t">atende</span>') : '<span class="no-t">' + c.falha.join(', ') + '</span>'}</td>`
        + `<td>${mk ? '' : `<a class="lk" data-marca="${c.ids.join(',')}">marcar</a>`}</td></tr>`;
    };
    const cab = t => `<tr><td colspan="7" style="padding-top:12px;border-bottom:1px solid var(--rule)"><b>${t}</b></td></tr>`;
    h += '<div class="tablewrap"><table class="t"><thead><tr><th>Agrupamento</th><th class="num">' + SA + '</th><th class="num">T*</th><th class="num">Σm</th><th class="num">ζ</th><th>Resultado</th><th></th></tr></thead><tbody>';
    if (r.topOk.length) { h += cab('Atendem às restrições, por valor azul'); r.topOk.slice(0, 8).forEach(c => { h += linha(c); }); }
    if (r.excluidos.length) { h += cab('Têm mais valor azul, mas ficam de fora'); r.excluidos.slice(0, 6).forEach(c => { h += linha(c); }); }
    $('xa').innerHTML = h + '</tbody></table></div>';
  }
  function renderPart() {
    const r = R; if (!r.n) { $('part').innerHTML = ''; return; }
    const pais = S.modo === 'pais', g = num(cfg().gamma);
    let h = '<div class="tablewrap"><table class="t"><thead><tr><th>Módulo</th><th class="num">V + γE</th><th class="num">b</th><th class="num">φ</th><th class="num">t</th>' + (pais ? '<th class="num">Título da Bolsa</th>' : '') + '</tr></thead><tbody>';
    let sV = 0, sb = 0, sp = 0, st = 0, sti = 0;
    r.sel.slice().sort(ordId).forEach(id => {
      const md = M.mods.find(m => m.id === id), v = md.V + g * md.E;
      sV += v; sb += r.b[id]; sp += r.phi[id]; st += r.t[id]; sti += md.tit || 0;
      h += `<tr><td><b>${esc(id)}</b><span class="nm">${esc(md.nome)}</span></td><td class="num">${full(v)}</td><td class="num">${full(r.b[id])}</td><td class="num">${full(r.phi[id])}</td><td class="num"><b>${full(r.t[id])}</b></td>` + (pais ? `<td class="num">${full(md.tit)}</td>` : '') + '</tr>';
    });
    h += `</tbody><tfoot><tr><td>Total</td><td class="num">${full(sV)}</td><td class="num">${full(sb)}</td><td class="num">${full(sp)}</td><td class="num">${full(st)}</td>` + (pais ? `<td class="num">${full(sti)}</td>` : '') + '</tr></tfoot></table></div>';
    h += `<p class="note">Σφ = v(N) = ${full(r.v)} (o melhor que o grupo faz olhando o caixa); Σ(V + γE) + Σb = f(N) = ${full(r.f)}; Σt = T* = ${full(r.T)}.`
      + (r.nucleoVazio ? ` O núcleo do jogo é vazio: o título que estabiliza todos os subgrupos é ${full(r.T_LP)}.` : r.shapNucleo ? ' A partilha de Shapley está no núcleo: nenhum subgrupo ganharia saindo.' : ' A partilha de Shapley está fora do núcleo (fornecedores concorrentes); o núcleo não é vazio, e um ponto dele deve ser usado.') + '</p>';
    $('part').innerHTML = h;
  }
  function renderCas() {
    const r = R; if (!r.n) { $('cas').innerHTML = ''; return; }
    const ativos = r.fluxos.filter(f => f.q > 1e-12);
    let h = '';
    if (!ativos.length) h += '<div class="empty">Nenhum elo de cascata entre os módulos marcados.</div>';
    else {
      h += '<div class="tablewrap"><table class="t"><thead><tr><th>Fluxo</th><th>Elo</th><th class="num">q</th><th class="num">s = u − p</th><th class="num">ψ</th><th class="num">Anual</th><th class="num">Valor presente</th><th class="c">Regen.</th></tr></thead><tbody>';
      ativos.forEach(f => {
        h += `<tr class="${f.s > 0 ? '' : 'off'}"><td>${tx(f.tipo)}</td><td class="mono">${esc(f.de)} → ${esc(f.para)}</td><td class="num">${qf(f.q)} ${esc(f.un)}</td><td class="num">${br(f.s, f.s < 10 ? 3 : 1)}</td><td class="num">${br(f.psi, 2)}</td><td class="num">${full(f.anual)}</td><td class="num">${full(f.vp)}</td><td class="c">${f.regen ? '✓' : ''}</td></tr>`;
      });
      h += `</tbody><tfoot><tr><td colspan="6">C(x) à taxa privada (à taxa social, que entra no valor azul: ${full(r.Cs)})</td><td class="num">${full(r.C)}</td><td></td></tr></tfoot></table></div>`;
      h += '<p class="note">Linhas em cinza: o fluxo passa, mas não tem ganho (s = 0), porque o insumo já é pago ao fornecedor ou o receptor não deixaria de comprar nada. Conta para a regeneração, não para C.</p>';
    }
    const sb = r.saidas.filter(s => s.S > 0);
    if (sb.length) {
      h += '<h3 style="font-size:14px;margin:14px 0 6px">Saídas e destino</h3><div class="tablewrap"><table class="t"><thead><tr><th>Saída</th><th>Fornecedor</th><th class="num">Oferta</th><th class="num">Usada no agrupamento</th><th class="num">Sem destino</th></tr></thead><tbody>';
      sb.forEach(s => { h += `<tr><td>${tx(s.tipo)}</td><td class="mono">${esc(s.de)}</td><td class="num">${qf(s.S)} ${esc(s.un)}</td><td class="num">${qf(s.usado)}</td><td class="num">${qf(s.sobra)}</td></tr>`; });
      h += '</tbody></table></div>';
    }
    h += `<p class="note">λ<sub>loc</sub>: ${r.lamLoc == null ? '—' : pct(r.lamLoc)} da demanda de insumos de cascata dos módulos marcados é atendida por saídas do próprio agrupamento.${r.zeta != null ? ` ζ = ${br(r.zeta, 2)} (fluxos regenerativos ÷ Z₀).` : ''}</p>`;
    $('cas').innerHTML = h;
  }
  function renderCurva() {
    const host = $('ch-gamma'), r = R;
    if (!r.n || !r.curva) { host.innerHTML = ''; return; }
    const W = Math.max(300, Math.round(host.clientWidth || 640)), g = num(cfg().gamma);
    const u = moeda(), mx0 = Math.max(...r.curva.map(c => c.T), r.F || 0);
    const [k, lab] = /mil/i.test(u) ? [1, u] : mx0 >= 1e6 ? [1e6, 'milhões de ' + u] : mx0 >= 1e4 ? [1e3, 'mil ' + u] : [1, u];
    const xs = r.curva.map(c => c.g), ys = r.curva.map(c => c.T / k), Fk = (r.F || 0) / k;
    const yg = interp(r.curva, g);
    const marks = [{ x: g, y: yg / k, label: `γ = ${br(g, 2)}: ${money(yg)}`, color: 'var(--s1)' }];
    if (r.gStar != null && r.gStar > 0) marks.push({ x: r.gStar, y: 0, label: `γ* = ${br(r.gStar, 2)}`, color: 'var(--s3)', dy: -10 });
    const ymax = Math.max(...ys, Fk) * 1.15 || 1;
    Charts.lines(host, {
      series: [{ name: 'T*', color: 'var(--s1)', x: xs, y: ys }], W, H: 250, xLabel: 'γ, parte do valor social valorizada pelos membros', yLabel: 'T* (' + lab + ')',
      xDomain: [0, 1], yDomain: [0, ymax], xFmt: v => br(v, 2), yFmt: v => br(v, ymax < 5 ? 2 : ymax < 50 ? 1 : 0), interactive: true,
      hlines: Fk > 0 && Fk < ymax ? [{ v: Fk, label: 'doação disponível F' }] : [], marks,
    });
  }
  function interp(c, g) { const i = Math.min(19, Math.floor(g * 20)); const a = c[i], b = c[i + 1] || a; const t = (g - a.g) / 0.05; return a.T + (b.T - a.T) * Math.max(0, Math.min(1, t)); }

  /* ------------------------------------------------------------ tabela de módulos */
  function renderMods() {
    const c = cfg(), pais = S.modo === 'pais';
    const mods = pais ? EN.modeloPais(paisAtual(), D, S.prm, { calor: S.calor }).mods : S.local.mods;
    $('mod-sub').innerHTML = pais
      ? 'Construir: módulos do agrupamento avaliado (x<sub>k</sub> = 1). Busca: podem entrar na procura do equilíbrio azul. Obrig.: precisam estar em qualquer agrupamento. V do M3 já desconta o CO<sub>2</sub> que o estudo supôs gratuito.'
      : 'Edite os valores na própria tabela. V: VPL financeiro do módulo sozinho; E: valor social além do financeiro; m: prioridade de necessidade básica; TRL de 1 a 9.';
    const ck = (id, k) => `<input type="checkbox" data-id="${esc(id)}" data-k="${k}" ${c[k].includes(id) ? 'checked' : ''} aria-label="${k} ${esc(id)}">`;
    let h = '<div class="tablewrap"><table class="t" id="tab-mod"><thead><tr><th class="c">Construir</th><th class="c">Busca</th><th class="c">Obrig.</th>';
    if (pais) {
      h += '<th>Módulo</th><th>Aplic.</th><th class="num">m</th><th class="num">TRL</th><th class="num">V</th><th class="num">E</th><th class="num">VPL social</th><th class="num">Título da Bolsa</th></tr></thead><tbody>';
      mods.forEach(m => {
        const ap = m.apl === 'Não' ? '<span class="tag no">não</span>' : m.apl === 'Condicional' ? '<span class="tag cd">condicional</span>' : '<span class="tag">sim</span>';
        h += `<tr data-row="${m.id}" class="${m.apl === 'Não' ? 'off' : ''}"><td class="c">${ck(m.id, 'sel')}</td><td class="c">${ck(m.id, 'busca')}</td><td class="c">${ck(m.id, 'obrig')}</td>`
          + `<td><b>${m.id}</b>${m.lote ? ' <span class="tag">lote</span>' : ''}<span class="nm">${esc(m.nome)}</span></td><td>${ap}</td><td class="num">${br(m.m, 1)}</td><td class="num">${m.TRL}</td>`
          + `<td class="num">${br(m.V)}</td><td class="num">${br(m.E)}</td><td class="num">${br(m.Vs)}</td><td class="num">${br(m.tit)}</td></tr>`;
      });
      h += '</tbody></table></div>';
      $('mod-tools').innerHTML = '<button class="btn sm" type="button" data-acao="lote">Lote da Bolsa Azul</button><button class="btn sm" type="button" data-acao="aplic">Marcar todos os aplicáveis</button><button class="btn sm" type="button" data-acao="limpa">Desmarcar todos</button>';
    } else {
      h += '<th>ID</th><th>Nome</th><th class="num">V</th><th class="num">E</th><th class="num">TRL</th><th class="num">m</th><th class="num">Vida (anos)</th><th class="num">Carência</th><th></th></tr></thead><tbody>';
      mods.forEach((m, i) => {
        const inp = (k, cls, step) => `<input type="number" class="${cls || ''}" data-i="${i}" data-f="${k}" value="${esc(m[k])}" step="${step || 'any'}" aria-label="${k} ${esc(m.id)}">`;
        h += `<tr data-row="${esc(m.id)}"><td class="c">${ck(m.id, 'sel')}</td><td class="c">${ck(m.id, 'busca')}</td><td class="c">${ck(m.id, 'obrig')}</td>`
          + `<td><b>${esc(m.id)}</b></td><td><input type="text" class="w-l" data-i="${i}" data-f="nome" value="${esc(m.nome)}" aria-label="nome ${esc(m.id)}"></td>`
          + `<td>${inp('V')}</td><td>${inp('E')}</td><td>${inp('TRL', 'w-s', 1)}</td><td>${inp('m', 'w-s')}</td><td>${inp('vida', 'w-s', 1)}</td><td>${inp('car', 'w-s', 1)}</td>`
          + `<td><button class="btn ghost sm" type="button" data-del-mod="${i}" aria-label="Remover ${esc(m.id)}">✕</button></td></tr>`;
      });
      h += '</tbody></table></div>';
      $('mod-tools').innerHTML = `<button class="btn sm" type="button" data-acao="add-mod" ${mods.length >= 16 ? 'disabled' : ''}>Adicionar módulo</button><button class="btn sm" type="button" data-acao="todos">Marcar todos</button><button class="btn sm" type="button" data-acao="limpa">Desmarcar todos</button>`;
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
      let h = '<details style="margin-top:12px"><summary class="muted" style="cursor:pointer;font-size:13px">Elos ZERI do estudo (' + L.length + ')</summary><div class="tablewrap"><table class="t"><thead><tr><th>Fluxo</th><th>Elo</th><th class="num">Oferta S</th><th class="num">Demanda D</th><th class="num">u</th><th class="num">p</th><th class="c">Regen.</th></tr></thead><tbody>';
      L.forEach(l => { h += `<tr><td>${tx(l.tipo)}</td><td class="mono">${l.de} → ${l.para}</td><td class="num">${br(l.S, 2)} ${l.un}</td><td class="num">${br(l.D, 2)}</td><td class="num">${br(l.u, 0)}</td><td class="num">${br(l.p, 0)}</td><td class="c">${l.regen ? '✓' : ''}</td></tr>`; });
      $('flx').innerHTML = h + '</tbody></table></div><p class="note">Fonte: Cascatas ZERI, Memoriais e Balanços do estudo ZERI LAB. Preços u e p vêm do painel de parâmetros. Para mudar ofertas e demandas, use Editar como local novo.</p></details>';
      return;
    }
    const ids = S.local.mods.map(m => m.id);
    const opt = v => ids.map(id => `<option value="${esc(id)}" ${id === v ? 'selected' : ''}>${esc(id)}</option>`).join('');
    let h = '<h3 style="font-size:14px;margin:16px 0 6px">Fluxos do local (editar)</h3><div class="tablewrap"><table class="t"><thead><tr><th>Fluxo</th><th>De</th><th>Para</th><th class="num">Oferta S</th><th class="num">Demanda D</th><th class="num">u</th><th class="num">p</th><th>Unidade</th><th class="c">Regen.</th><th></th></tr></thead><tbody>';
    S.local.links.forEach((l, i) => {
      const inp = (k, t) => `<input type="${t || 'number'}" data-l="${i}" data-f="${k}" value="${esc(l[k])}" step="any" class="${t ? '' : 'w-s'}" aria-label="${k}">`;
      h += `<tr><td>${inp('tipo', 'text')}</td><td><select data-l="${i}" data-f="de" aria-label="de">${opt(l.de)}</select></td><td><select data-l="${i}" data-f="para" aria-label="para">${opt(l.para)}</select></td>`
        + `<td>${inp('S')}</td><td>${inp('D')}</td><td>${inp('u')}</td><td>${inp('p')}</td><td>${inp('un', 'text')}</td><td class="c"><input type="checkbox" data-l="${i}" data-f="regen" ${l.regen ? 'checked' : ''} aria-label="regenerativo"></td>`
        + `<td><button class="btn ghost sm" type="button" data-del-l="${i}" aria-label="Remover fluxo">✕</button></td></tr>`;
    });
    h += '</tbody></table></div><div class="tools"><button class="btn sm" type="button" data-acao="add-l">Adicionar fluxo</button></div>'
      + '<p class="note">u: custo que o receptor deixa de pagar por unidade; p: preço que o fornecedor já recebe por ela fora do agrupamento. Marque Regen. nos fluxos que dão destino ao resíduo do território (entram em ζ).</p>';
    $('flx').innerHTML = h;
  }

  /* ------------------------------------------------------------ controles */
  function preencheControles() {
    const c = cfg(), pais = S.modo === 'pais';
    $('m-pais').setAttribute('aria-pressed', pais); $('m-local').setAttribute('aria-pressed', !pais);
    $('src-pais').hidden = !pais; $('src-local').hidden = pais;
    $('prm-pais').hidden = !pais; $('prm-local').hidden = pais; $('b-link').hidden = !pais;
    $('gam').value = c.gamma; $('gam-r').value = c.gamma;
    $('f-modo').value = c.Fmodo; $('m-modo').value = c.mmodo; $('t-modo').value = c.tmodo;
    $('f-val').value = c.Fval == null ? '' : c.Fval; $('m-val').value = c.mval == null ? '' : c.mval; $('t-val').value = c.tval == null ? '' : c.tval;
    $('f-val').disabled = c.Fmodo !== 'valor'; $('m-val').disabled = c.mmodo !== 'valor'; $('t-val').disabled = c.tmodo !== 'valor';
    $('f-modo').querySelector('option[value=bolsa]').textContent = pais ? 'Títulos da Bolsa' : 'Títulos de referência';
    $('regen').checked = !!c.regen; $('z0').value = c.Z0 || ''; $('theta').value = c.theta;
    ['p_co2', 'p_calor', 'p_heatv', 'p_exa', 'p_glp'].forEach(k => { $(k).value = S.prm[k]; });
    $('calor').checked = S.calor;
    $('tsoc').value = pais ? S.prm.tsoc : S.local.tsoc;
    if (pais) {
      const p = paisAtual();
      $('sel-pais').value = p.nome;
      $('pais-meta').textContent = `${p.macro} · ${p.leitura} · IDH ${br(p.idh, 3)} · taxa com risco-país ${pct(p.taxa, 0)} · operabilidade ${br(p.W, 2)} · valores em USD`;
    } else {
      $('loc-nome').value = S.local.nome; $('l-taxa').value = S.local.taxa; $('l-W').value = S.local.W; $('l-moeda').value = S.local.moeda;
      $('local-meta').textContent = `${S.local.mods.length} módulos · ${S.local.links.length} fluxos · salvo neste navegador`;
    }
  }
  function trocaModo(m) { S.modo = m; history.replaceState(null, '', m === 'pais' ? '#pais=' + encodeURIComponent(S.pais) : '#local'); preencheControles(); renderMods(); calcular(); }

  // origem
  $('m-pais').addEventListener('click', () => trocaModo('pais'));
  $('m-local').addEventListener('click', () => trocaModo('local'));
  const macros = [...new Set(D.paises.map(p => p.macro))];
  $('sel-pais').innerHTML = macros.map(m => `<optgroup label="${esc(m)}">` + D.paises.filter(p => p.macro === m).map(p => `<option>${esc(p.nome)}</option>`).join('') + '</optgroup>').join('');
  $('sel-pais').addEventListener('change', e => { abrirPais(e.target.value); history.replaceState(null, '', '#pais=' + encodeURIComponent(S.pais)); preencheControles(); renderMods(); calcular(); });
  $('b-lote').addEventListener('click', () => { abrirPais(S.pais); renderMods(); calcular(); });
  $('b-editar').addEventListener('click', () => {
    const md = EN.modeloPais(paisAtual(), D, S.prm, { calor: S.calor });
    S.local = { nome: S.pais + ' (cópia editável)', moeda: 'USD', taxa: md.taxa, tsoc: S.prm.tsoc, W: md.W,
      mods: md.mods.map(m => ({ id: m.id, nome: m.nome, V: Math.round(m.V), E: Math.round(m.E), TRL: m.TRL, m: m.m, vida: m.vida, car: m.car, apl: m.apl, tit: Math.round(m.tit) })),
      links: md.links.map(l => Object.assign({}, l)), cfg: JSON.parse(JSON.stringify(S.cfgPais)) };
    trocaModo('local');
  });
  $('loc-nome').addEventListener('input', e => { S.local.nome = e.target.value; agenda(); });
  $('loc-preset').addEventListener('change', e => {
    const v = e.target.value; e.target.value = '';
    if (!v) return;
    if (!confirmaTroca()) return;
    S.local = v === 'garuva' ? garuva() : branco(); preencheControles(); renderMods(); calcular();
  });
  function confirmaTroca() { return true; }
  $('b-exp').addEventListener('click', () => baixar((S.local.nome || 'local').replace(/[^\w\-]+/g, '_') + '.json', JSON.stringify(S.local, null, 1), 'application/json'));
  $('f-imp').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const L = JSON.parse(rd.result);
        if (!Array.isArray(L.mods) || !Array.isArray(L.links)) throw new Error('arquivo sem mods e links');
        L.cfg = Object.assign({}, CFG0, L.cfg || {}); if (!L.cfg.sel.length) L.cfg.sel = L.mods.map(m => m.id); if (!L.cfg.busca.length) L.cfg.busca = L.mods.map(m => m.id);
        S.local = Object.assign({ nome: 'Local importado', moeda: 'R$ mil', taxa: 0.1, tsoc: 0.06, W: 1 }, L);
        preencheControles(); renderMods(); calcular();
      } catch (err) { $('local-meta').textContent = 'Não foi possível importar: ' + err.message; }
    };
    rd.readAsText(f); e.target.value = '';
  });

  // parâmetros
  const liga = (id, fn, ev) => $(id).addEventListener(ev || 'input', e => { fn(e.target); agenda(); });
  liga('gam', t => { const v = Math.min(1, Math.max(0, num(t.value))); cfg().gamma = v; $('gam-r').value = v; });
  liga('gam-r', t => { cfg().gamma = num(t.value); $('gam').value = t.value; });
  liga('f-modo', t => { cfg().Fmodo = t.value; if (t.value === 'valor' && cfg().Fval == null && R && R.T != null) { cfg().Fval = Math.round(R.T * 100) / 100; } preencheControles(); }, 'change');
  liga('m-modo', t => { cfg().mmodo = t.value; if (t.value === 'valor' && cfg().mval == null && R) cfg().mval = R.m; preencheControles(); }, 'change');
  liga('t-modo', t => { cfg().tmodo = t.value; if (t.value === 'valor' && cfg().tval == null) cfg().tval = Math.max(1, cfg().sel.length); preencheControles(); }, 'change');
  liga('f-val', t => { cfg().Fval = num(t.value); });
  liga('m-val', t => { cfg().mval = num(t.value); });
  liga('t-val', t => { cfg().tval = num(t.value, 1); });
  liga('regen', t => { cfg().regen = t.checked; }, 'change');
  liga('z0', t => { cfg().Z0 = Math.max(0, num(t.value)); });
  liga('theta', t => { cfg().theta = Math.max(0.01, num(t.value, 1)); });
  ['p_co2', 'p_calor', 'p_heatv', 'p_exa', 'p_glp'].forEach(k => liga(k, t => { S.prm[k] = Math.max(0, num(t.value)); renderModsSoft(); }));
  liga('calor', t => { S.calor = t.checked; renderFlx(); }, 'change');
  liga('tsoc', t => { if (S.modo === 'pais') { S.prm.tsoc = Math.max(0, num(t.value)); renderModsSoft(); } else S.local.tsoc = Math.max(0, num(t.value)); });
  liga('l-taxa', t => { S.local.taxa = Math.max(0, num(t.value)); });
  liga('l-W', t => { S.local.W = Math.max(0, num(t.value, 1)); });
  liga('l-moeda', t => { S.local.moeda = t.value || 'R$ mil'; });
  $('b-padrao').addEventListener('click', () => {
    if (S.modo === 'pais') { Object.assign(S.prm, PRM0); S.calor = false; Object.assign(S.cfgPais, { gamma: 0, Fmodo: 'tstar', Fval: null, mmodo: 'sel', mval: null, tmodo: 'sel', tval: null, regen: false, Z0: 0, theta: 1 }); }
    else Object.assign(S.local.cfg, { gamma: 0, theta: 1 });
    preencheControles(); renderMods(); calcular();
  });
  let rmT = null;
  function renderModsSoft() { clearTimeout(rmT); rmT = setTimeout(() => { const y = window.scrollY; renderMods(); atualizaModStatus(); window.scrollTo(0, y); }, 250); }

  // tabela de módulos e fluxos (delegação)
  $('mod').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.k) {
      const c = cfg(), arr = c[t.dataset.k], id = t.dataset.id;
      const i = arr.indexOf(id); if (t.checked && i < 0) arr.push(id); if (!t.checked && i >= 0) arr.splice(i, 1);
      calcular(); return;
    }
  });
  $('mod').addEventListener('input', e => {
    const t = e.target; if (t.dataset.i == null) return;
    const m = S.local.mods[+t.dataset.i]; m[t.dataset.f] = t.type === 'number' ? t.value : t.value; agenda();
  });
  $('mod').addEventListener('click', e => {
    const b = e.target.closest('[data-del-mod]'); if (!b) return;
    const m = S.local.mods.splice(+b.dataset.delMod, 1)[0];
    const c = S.local.cfg; ['sel', 'busca', 'obrig'].forEach(k => { c[k] = c[k].filter(x => x !== m.id); });
    S.local.links = S.local.links.filter(l => l.de !== m.id && l.para !== m.id);
    renderMods(); calcular();
  });
  $('mod-tools').addEventListener('click', e => {
    const a = e.target.dataset.acao; if (!a) return; const c = cfg();
    if (a === 'lote') { abrirPais(S.pais); }
    if (a === 'aplic') { const p = paisAtual(); c.sel = p.mods.filter(m => m.apl !== 'Não').map(m => m.id); }
    if (a === 'todos') { c.sel = S.local.mods.map(m => m.id); }
    if (a === 'limpa') { c.sel = []; }
    if (a === 'add-mod') {
      let n = 1; const ids = new Set(S.local.mods.map(m => m.id)); while (ids.has('L' + n)) n++;
      const id = 'L' + n; S.local.mods.push({ id, nome: 'Módulo ' + n, V: 0, E: 0, TRL: 9, m: 0, vida: 10, car: 0, apl: 'Sim', tit: 0 });
      c.sel.push(id); c.busca.push(id);
    }
    renderMods(); calcular();
  });
  $('flx').addEventListener('input', e => {
    const t = e.target; if (t.dataset.l == null) return;
    const l = S.local.links[+t.dataset.l]; l[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; agenda();
  });
  $('flx').addEventListener('change', e => {
    const t = e.target; if (t.dataset.l == null) return;
    const l = S.local.links[+t.dataset.l]; l[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; calcular();
  });
  $('flx').addEventListener('click', e => {
    const d = e.target.closest('[data-del-l]');
    if (d) { S.local.links.splice(+d.dataset.delL, 1); renderFlx(); calcular(); return; }
    if (e.target.dataset.acao === 'add-l') {
      const ids = S.local.mods.map(m => m.id);
      S.local.links.push({ tipo: 'fluxo', de: ids[0] || '', para: ids[1] || ids[0] || '', S: 0, D: 0, u: 0, p: 0, un: 't/a', regen: false });
      renderFlx(); calcular();
    }
  });
  document.addEventListener('click', e => {
    const m = e.target.closest('[data-marca]'); if (!m) return;
    cfg().sel = m.dataset.marca.split(','); renderMods(); calcular();
    document.getElementById('kpis').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // exportações
  function baixar(nome, txt, tipo) {
    const b = new Blob([txt], { type: tipo + ';charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const csvCell = v => { const s = typeof v === 'number' ? String(Math.round(v * 1000) / 1000).replace('.', ',') : String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = rows => '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\n');
  $('b-csv').addEventListener('click', () => {
    if (!R || !R.n) return;
    const nome = S.modo === 'pais' ? S.pais : S.local.nome, rows = [];
    rows.push(['Simulador do Equilíbrio Azul', nome, 'moeda: ' + moeda()]); rows.push([]);
    rows.push(['Agrupamento', lista(R.sel)]); rows.push(['Valor azul A', R.A]); rows.push(['Cascata C (taxa privada)', R.C]); rows.push(['Cascata C (taxa social)', R.Cs]);
    rows.push(['v(N)', R.v]); rows.push(['f(N)', R.f]); rows.push(['T*', R.T]); rows.push(['Doação F', R.F]); rows.push(['E^N', R.E_N]); rows.push(['lambda_T', R.lamT]); rows.push(['gamma*', R.gStar]); rows.push(['gamma usado', R.gamma]);
    rows.push(['Equilíbrio azul', R.xA ? lista(R.xA.ids) : 'nenhum']); rows.push(['A do equilíbrio azul', R.xA ? R.xA.A : '']); rows.push(['T* do equilíbrio azul', R.xA ? R.xA.T : '']); rows.push([]);
    rows.push(['Módulo', 'V', 'E', 'b', 'phi', 't']);
    R.sel.slice().sort(ordId).forEach(id => { const md = M.mods.find(m => m.id === id); rows.push([id, md.V, md.E, R.b[id], R.phi[id], R.t[id]]); });
    rows.push([]); rows.push(['Fluxo', 'De', 'Para', 'q', 'Unidade', 's', 'psi', 'Anual', 'VP']);
    R.fluxos.forEach(f => rows.push([f.tipo, f.de, f.para, f.q, f.un, f.s, f.psi, f.anual, f.vp]));
    rows.push([]); rows.push(['Agrupamento', 'A', 'T*', 'Soma m', 'zeta', 'Atende', 'Falhas']);
    R.top.forEach(c => rows.push([lista(c.ids), c.A, c.T, c.m, c.zeta == null ? '' : c.zeta, c.ok ? 'sim' : 'não', c.falha.join(', ')]));
    baixar('equilibrio_azul_' + nome.replace(/[^\w\-]+/g, '_') + '.csv', csv(rows), 'text/csv');
  });
  $('b-link').addEventListener('click', () => {
    const url = location.href.split('#')[0] + '#pais=' + encodeURIComponent(S.pais);
    const ok = () => { $('b-link').textContent = 'Link copiado'; setTimeout(() => { $('b-link').textContent = 'Copiar link deste país'; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, () => { history.replaceState(null, '', url); });
    else history.replaceState(null, '', url);
  });

  /* ------------------------------------------------------------ ranking */
  let RK = null, rkChave = '', rkSort = { col: 'T', dir: 'desc' };
  function chaveRk() { return JSON.stringify([S.prm, S.calor, S.cfgPais.gamma]); }
  function calcRanking() {
    const ch = chaveRk(); if (RK && ch === rkChave) { renderRanking(); return; }
    rkChave = ch; RK = []; const bar = $('r-prog').firstElementChild; let i = 0;
    const passo = () => {
      const t0 = performance.now();
      while (i < D.paises.length && performance.now() - t0 < 30) {
        const p = D.paises[i++], md = EN.modeloPais(p, D, S.prm, { calor: S.calor }), lp = lotePais(p);
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
    const rows = RK.filter(r => (!mc || r.macro === mc) && (!q || r.pais.toLowerCase().includes(q)) && (!so || !r.igual));
    const k = rkSort.col, d = rkSort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => { const x = a[k], y = b[k]; if (typeof x === 'string') return d * x.localeCompare(y, 'pt-BR'); return d * (((x == null) ? -Infinity : x) - ((y == null) ? -Infinity : y)); });
    const sT = RK.reduce((s, r) => s + r.T, 0), sB = RK.reduce((s, r) => s + r.tit, 0), sA = RK.reduce((s, r) => s + r.A, 0), sG = RK.reduce((s, r) => s + r.ganho, 0);
    const mi = v => br(v / 1e6, 2) + ' mi';
    $('r-kpis').innerHTML = kpi('Título social T* (101 lotes)', mi(sT), 'Bolsa Azul: ' + mi(sB) + ' (' + (sT >= sB ? '+' : '') + pct((sT - sB) / sB, 1) + ')')
      + kpi('Valor azul ' + SA, mi(sA), 'VPL social + cascata, USD') + kpi('Lotes que já são o equilíbrio', RK.filter(r => r.igual).length + ' de ' + RK.length, 'mesma doação e restrições')
      + kpi('Ganho possível', mi(sG), 'trocando para o equilíbrio azul') + kpi('γ usado', br(S.cfgPais.gamma, 2), 'CO₂ a ' + br(S.prm.p_co2) + ' USD/t' + (S.calor ? ' · com calor' : ''));
    const cols = [['pais', 'País', 0], ['lote', 'Lote', 0], ['tit', 'Títulos da Bolsa', 1], ['T', 'T*', 1], ['dif', 'Diferença', 1], ['A', SA, 1], ['EN', 'E<sup>N</sup>', 1], ['lamT', 'λ<sub>T</sub>', 1], ['g', 'γ*', 1], ['xA', 'Equilíbrio azul', 0], ['ganho', 'Ganho de ' + SA, 1]];
    let h = '<div class="tablewrap"><table class="t"><thead><tr>' + cols.map(c => `<th class="sort ${c[2] ? 'num' : ''}" data-col="${c[0]}" ${k === c[0] ? `data-dir="${rkSort.dir}"` : ''}>${c[1]}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach(r => {
      h += `<tr><td><a class="lk" data-abre="${esc(r.pais)}">${esc(r.pais)}</a><span class="nm">${esc(r.macro)}</span></td><td class="mono">${r.lote}</td><td class="num">${br(r.tit)}</td><td class="num">${br(r.T)}</td><td class="num">${br(r.dif)}</td><td class="num">${br(r.A)}</td>`
        + `<td class="num">${pct(r.EN)}</td><td class="num">${r.lamT == null ? '—' : br(r.lamT, 1)}</td><td class="num">${r.g == null ? '—' : br(r.g, 2)}</td><td class="mono">${r.xA || '<span class="muted">o próprio lote</span>'}</td><td class="num">${r.ganho ? br(r.ganho) : ''}</td></tr>`;
    });
    $('r-tab').innerHTML = h + '</tbody></table></div><p class="note">' + rows.length + ' de ' + RK.length + ' países. Valores em USD.</p>';
  }
  $('r-macro').innerHTML += macros.map(m => `<option>${esc(m)}</option>`).join('');
  ['r-macro', 'r-dif'].forEach(id => $(id).addEventListener('change', renderRanking));
  $('r-busca').addEventListener('input', renderRanking);
  $('r-tab').addEventListener('click', e => {
    const th = e.target.closest('th[data-col]');
    if (th) { const c = th.dataset.col; rkSort = { col: c, dir: rkSort.col === c && rkSort.dir === 'desc' ? 'asc' : 'desc' }; renderRanking(); return; }
    const a = e.target.closest('[data-abre]');
    if (a) { abrirPais(a.dataset.abre); S.modo = 'pais'; abaSel('t-local'); trocaModo('pais'); window.scrollTo(0, 0); }
  });
  $('r-csv').addEventListener('click', () => {
    if (!RK) return;
    const rows = [['País', 'Macrorregião', 'Lote', 'Títulos da Bolsa (USD)', 'T* (USD)', 'Diferença (USD)', 'Valor azul A (USD)', 'E^N', 'lambda_T', 'gamma*', 'Equilíbrio azul', 'Ganho de A (USD)']];
    RK.forEach(r => rows.push([r.pais, r.macro, r.lote, r.tit, r.T, r.dif, r.A, r.EN, r.lamT, r.g, r.xA || 'o próprio lote', r.ganho]));
    baixar('ranking_equilibrio_azul.csv', csv(rows), 'text/csv');
  });

  /* ------------------------------------------------------------ abas e tema */
  const abas = ['t-local', 't-rank', 't-como'];
  function abaSel(id) {
    abas.forEach(a => { const on = a === id; $(a).setAttribute('aria-selected', on); $(a.replace('t-', 'p-')).hidden = !on; });
    if (id === 't-rank') calcRanking();
    if (id === 't-local') setTimeout(renderCurva, 0);
  }
  abas.forEach(a => $(a).addEventListener('click', () => abaSel(a)));
  $('t-local').parentElement.addEventListener('keydown', e => {
    const i = abas.indexOf(document.activeElement.id); if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const j = (i + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length; $(abas[j]).focus(); abaSel(abas[j]); }
  });
  const temas = ['', 'light', 'dark'], nomesTema = { '': 'automático', light: 'claro', dark: 'escuro' };
  let tema = LS.get('ea-tema', '') || '';
  const aplicaTema = () => { if (tema) document.documentElement.setAttribute('data-theme', tema); else document.documentElement.removeAttribute('data-theme'); $('tema').textContent = 'Tema: ' + nomesTema[tema]; setTimeout(renderCurva, 0); };
  $('tema').addEventListener('click', () => { tema = temas[(temas.indexOf(tema) + 1) % 3]; try { tema ? localStorage.setItem('ea-tema', tema) : localStorage.removeItem('ea-tema'); } catch (e) { /* sem armazenamento */ } aplicaTema(); });
  aplicaTema();
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastW) > 30) { lastW = window.innerWidth; clearTimeout(rmT); rmT = setTimeout(renderCurva, 150); } });

  /* ------------------------------------------------------------ início */
  try { if (window.matchMedia('(max-width: 1100px)').matches) $('prm-det').open = false; } catch (e) { /* navegador antigo */ }
  preencheControles(); renderMods(); calcular();
  window.__pronto = true;
})();
