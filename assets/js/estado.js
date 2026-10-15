/* Estado do simulador (salvo no navegador) e montagem do modelo; usado pelo simulador e pelo dashboard. */
window.Estado = (function () {
  'use strict';
  const D = window.DADOS, EN = window.Engine, t = k => (window.I18N ? I18N.t(k) : k);
  const num = (v, d = 0) => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : d; };
  const ordId = (a, b) => { const pa = a.match(/^(\D*)(\d*)$/) || [a, a, ''], pb = b.match(/^(\D*)(\d*)$/) || [b, b, '']; return pa[1] === pb[1] ? (+pa[2] || 0) - (+pb[2] || 0) : (pa[1] < pb[1] ? -1 : 1); };
  const PRM0 = { p_co2: 335, p_calor: 20, p_heatv: 15, p_exa: 15, p_glp: 90, tsoc: 0.06 };
  const CFG0 = { gamma: 0, sel: [], busca: [], obrig: [], Fmodo: 'tstar', Fval: null, mmodo: 'sel', mval: null, tmodo: 'sel', tval: null, regen: false, Z0: 0, theta: 1 };
  const ler = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* armazenamento indisponível */ } };

  function garuva() {
    const m = (id, V, E, TRL, mm) => ({ id, nome: t('garuva.' + id), V, E, TRL, m: mm, vida: 10, car: 0, apl: 'Sim', tit: 0 });
    return {
      nome: t('garuva.nome'), moeda: t('u.garuva'), taxa: 0.10, tsoc: 0.10, W: 1,
      mods: [m('G1', 150, 200, 9, 2), m('G2', -300, 90, 6, 1), m('G3', -40, 70, 9, 4), m('G4', -20, 30, 9, 3)],
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
    const md = n => ({ id: 'L' + n, nome: t('mod.novo').replace('{n}', n), V: 0, E: 0, TRL: 9, m: 0, vida: 10, car: 0, apl: 'Sim', tit: 0 });
    return { nome: t('local.novo'), moeda: t('u.garuva'), taxa: 0.10, tsoc: 0.06, W: 1, mods: [md(1), md(2)], links: [],
      cfg: Object.assign({}, CFG0, { sel: ['L1', 'L2'], busca: ['L1', 'L2'], tmodo: 'livre' }) };
  }
  function lotePais(p) {
    const lote = p.mods.filter(m => m.lote).map(m => m.id).sort(ordId);
    const need13 = lote.includes('M13');
    const busca = p.mods.filter(m => m.apl !== 'Não' && m.id !== 'M13').map(m => m.id).concat(need13 ? ['M13'] : []);
    return { sel: lote, busca, obrig: need13 ? ['M13'] : [] };
  }

  /* estado salvo pelo simulador (ou o padrão) */
  function carregar() {
    const S = { modo: 'pais', pais: 'Etiópia', prm: Object.assign({}, PRM0), calor: false, cfgPais: Object.assign({}, CFG0), local: null, salvo: false };
    const s = ler('ea-estado', null);
    if (s && typeof s === 'object') {
      try {
        S.salvo = true;
        if (s.prm) Object.assign(S.prm, s.prm);
        S.calor = !!s.calor;
        if (s.local && Array.isArray(s.local.mods)) { S.local = s.local; S.local.cfg = Object.assign({}, CFG0, S.local.cfg || {}); }
        if (s.cfgPais) Object.keys(CFG0).forEach(k => { if (k in s.cfgPais) S.cfgPais[k] = s.cfgPais[k]; });
        if (s.pais && D.paises.some(p => p.nome === s.pais)) S.pais = s.pais;
        if (s.modo === 'local' && S.local) S.modo = 'local';
      } catch (e) { /* estado antigo inválido: segue com o padrão */ }
    }
    if (!S.local) S.local = garuva();
    if (!S.cfgPais.sel.length) Object.assign(S.cfgPais, lotePais(paisDe(S.pais)));
    return S;
  }
  const salvar = S => gravar('ea-estado', { modo: S.modo, pais: S.pais, prm: S.prm, calor: S.calor, cfgPais: S.cfgPais, local: S.local });
  const paisDe = nome => D.paises.find(p => p.nome === nome);
  const cfgDe = S => (S.modo === 'pais' ? S.cfgPais : S.local.cfg);

  /* modelo genérico para o motor */
  function modelo(S) {
    if (S.modo === 'pais') return EN.modeloPais(paisDe(S.pais), D, S.prm, { calor: S.calor });
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

  /* avaliação completa com a configuração do estado */
  function avaliar(S, M, extra) {
    const c = cfgDe(S), ids = M.mods.map(m => m.id);
    const sel = c.sel.filter(id => ids.includes(id)), busca = c.busca.filter(id => ids.includes(id)), obrig = c.obrig.filter(id => ids.includes(id));
    const tit = M.mods.filter(m => sel.includes(m.id)).reduce((s, m) => s + (m.tit || 0), 0);
    const F = c.Fmodo === 'tstar' ? null : c.Fmodo === 'bolsa' ? tit : num(c.Fval);
    const mbar = c.mmodo === 'sel' ? null : num(c.mval);
    const maxTam = c.tmodo === 'sel' ? Math.max(1, sel.length) : c.tmodo === 'livre' ? 99 : Math.max(1, Math.round(num(c.tval, 1)));
    const Z0 = Math.max(0, num(c.Z0));
    const R = EN.avaliar(M, Object.assign({ gamma: Math.min(1, Math.max(0, num(c.gamma))), sel, universo: busca, obrig, maxTam, F, mbar,
      theta: Math.max(0.01, num(c.theta, 1)), Z0, regen: !!c.regen && Z0 > 0, top: 12 }, extra || {}));
    R.regenAplicada = !!c.regen && Z0 > 0; R.maxTam = maxTam;
    return R;
  }

  return { PRM0, CFG0, garuva, branco, lotePais, carregar, salvar, paisDe, cfgDe, modelo, avaliar, num, ordId, ler, gravar };
})();
