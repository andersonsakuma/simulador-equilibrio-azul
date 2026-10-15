/* Motor da Equação do Equilíbrio Azul — mesma lógica do motor em Python do estudo (azul_engine.py).
   Funciona no navegador (window.Engine) e no Node (require), para os testes.

   Notação:
     V_k   VPL financeiro do módulo sozinho          E_k = VPLsocial_k − V_k
     C(R)  cascata ZERI entre os módulos de R (transporte, ganho s = u − p, maturidade ψ = TRL mínimo / 9)
     f(R)  Σ (V_k + γ E_k) + C(R)                     v(S) = max_{R⊆S} f(R)
     T*    v(N) − f(N)                                𝒜(x) = Σ VPLsocial_k + C_social(x)
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const af = (r, n) => (Math.abs(r) < 1e-12 ? n : (1 - Math.pow(1 + r, -n)) / r);
  const PADRAO = { p_co2: 335, p_calor: 20, p_heatv: 15, p_exa: 15, p_glp: 90, tsoc: 0.06, gamma: 0, theta: 1 };
  const M3_CO2 = 14.85; // t/a de CO2 injetado no M3 (Memoriais do estudo)
  const popc = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const FACT = [1]; for (let i = 1; i <= 20; i++) FACT[i] = FACT[i - 1] * i;

  /* ------------------------------------------------------------ fluxos ZERI do estudo (17 elos + cenário de calor) */
  function linksPais(p, calor) {
    const L = [
      ['calor', 'M1', 'M2', 262.0116, 150.0, p.p_calor, 0, 'MWh/a', false],
      ['calor', 'M7', 'M2', 733.63248, 150.0, p.p_calor, p.p_heatv, 'MWh/a', false],
      ['CO2', 'M1', 'M3', 86.5926, M3_CO2, p.p_co2, 0, 't/a', false],
      ['CO2', 'M7', 'M3', 307.8848, M3_CO2, p.p_co2, 0, 't/a', false],
      ['CO2', 'M10', 'M3', 30.6086956521739, M3_CO2, p.p_co2, 0, 't/a', false],
      ['CO2', 'M10', 'M13', 30.6086956521739, 13.14, 0, 0, 't/a', false],
      ['substrato', 'M10', 'M1', 66.0, 730.0, p.p_exa, 0, 't/a', false],
      ['substrato', 'M2', 'M1', 300.0, 730.0, p.p_exa, p.p_exa, 't/a', false],
      ['digestato', 'M7', 'M3', 3174.624, 181.5, 0, 0, 't/a', true],
      ['digestato', 'M1', 'M3', 1910.3005, 181.5, 0, 0, 't/a', true],
      ['digestato', 'M7', 'M13', 3174.624, 365.0, 0, 0, 't/a', true],
      ['digestato', 'M1', 'M13', 1910.3005, 365.0, 0, 0, 't/a', true],
      ['digestato', 'M1', 'M6', 1910.3005, 100.0, 0, 0, 't/a', true],
      ['restos', 'M13', 'M2', 30.0, 200.0, 0, 0, 't MS/a', false],
      ['restos', 'M5', 'M2', 8.0, 200.0, 0, 0, 't MS/a', false],
      ['larva', 'M13', 'M1', 1.8, 32.85, 0, 0, 't MS/a', false],
      ['água', 'M5', 'M13', 35032.0, 21900.0, 0, 0, 't/a', false],
    ];
    if (calor) {
      L.push(['calor', 'M1', 'M10', 262.0116, 392.26, p.p_glp, 0, 'MWh/a', false]);
      L.push(['calor', 'M7', 'M10', 733.63248, 392.26, p.p_glp, p.p_heatv, 'MWh/a', false]);
    }
    return L.map(l => ({ tipo: l[0], de: l[1], para: l[2], S: l[3], D: l[4], u: l[5], p: l[6], un: l[7], regen: l[8] }));
  }

  /* país do estudo → modelo genérico (aplica o ajuste do CO2 do M3, que o estudo supôs gratuito) */
  function modeloPais(pais, dados, prm, opc) {
    prm = Object.assign({}, PADRAO, prm || {}); opc = opc || {};
    const mods = pais.mods.map(r => {
      let V = r.V, Vs = r.Vs;
      if (r.id === 'M3') {
        const custo = M3_CO2 * prm.p_co2 * pais.W;
        V -= custo * af(pais.taxa, r.vida);
        Vs -= custo * af(prm.tsoc, r.vida);
      }
      return { id: r.id, nome: dados.modulos[r.id], apl: r.apl, m: r.m, TRL: dados.trl[r.id], vida: r.vida, car: r.car,
               V, Vs, E: Vs - V, Vestudo: r.V, Vsestudo: r.Vs, tit: r.tit, emp: r.emp, capex: r.capex, lote: r.lote, ver: r.ver, ind: r.ind, un: r.un };
    });
    return { nome: pais.nome, tipo: 'pais', moeda: 'USD', taxa: pais.taxa, tsoc: prm.tsoc, W: pais.W, mods, links: linksPais(prm, opc.calor) };
  }

  /* ------------------------------------------------------------ preparação do modelo para um conjunto de módulos ativos */
  function preparar(model, ativos) {
    const ids = ativos || model.mods.map(m => m.id);
    const pos = {}; ids.forEach((id, i) => { pos[id] = i; });
    const M = ids.map(id => model.mods.find(m => m.id === id));
    const L = [];
    model.links.forEach((l, ord) => {
      const i = pos[l.de], j = pos[l.para];
      if (i === undefined || j === undefined || i === j) return;
      const s = Math.max(0, (+l.u || 0) - (+l.p || 0));
      const t = Math.min(M[i].TRL, M[j].TRL);
      const h = Math.min(M[i].vida, M[j].vida), c = Math.max(M[i].car || 0, M[j].car || 0);
      L.push({ tipo: l.tipo, de: l.de, para: l.para, i, j, S: +l.S || 0, D: +l.D || 0, u: +l.u || 0, p: +l.p || 0, s, un: l.un || '', regen: !!l.regen,
               psi: t / 9, key: -s * t, ord,
               fp: af(model.taxa, h) * Math.pow(1 + model.taxa, -c), fs: af(model.tsoc, h) * Math.pow(1 + model.tsoc, -c) });
    });
    L.sort((a, b) => (a.key - b.key) || (a.de < b.de ? -1 : a.de > b.de ? 1 : 0) || (a.ord - b.ord));
    return { ids, M, L, n: ids.length, W: model.W };
  }

  /* cascata: alocação gulosa (maior ganho × maturidade primeiro), igual ao motor do estudo */
  function cascata(P, mask, detalhe) {
    const us = {}, ud = {}; let pv = 0, pvs = 0, an = 0, qreg = 0; const fl = detalhe ? [] : null;
    for (const l of P.L) {
      if (!((mask >> l.i) & 1) || !((mask >> l.j) & 1)) continue;
      const ks = l.tipo + '|' + l.i, kd = l.tipo + '|' + l.j;
      const q = Math.max(0, Math.min(l.S - (us[ks] || 0), l.D - (ud[kd] || 0)));
      us[ks] = (us[ks] || 0) + q; ud[kd] = (ud[kd] || 0) + q;
      const a = l.psi * l.s * q * P.W;
      pv += a * l.fp; pvs += a * l.fs; an += a;
      if (l.regen) qreg += q;
      if (fl) fl.push({ tipo: l.tipo, de: l.de, para: l.para, q, un: l.un, S: l.S, D: l.D, u: l.u, p: l.p, s: l.s, psi: l.psi, anual: a, vp: a * l.fp, vps: a * l.fs, regen: l.regen });
    }
    return { pv, pvs, an, qreg, fl, us, ud };
  }

  /* tabelas de todos os subconjuntos dos módulos ativos */
  function tabelas(P, gamma) {
    const n = P.n, NM = 1 << n;
    const sV = new Float64Array(NM), sE = new Float64Array(NM), sVs = new Float64Array(NM), sM = new Float64Array(NM);
    const C = new Float64Array(NM), Cs = new Float64Array(NM), Q = new Float64Array(NM);
    for (let mask = 1; mask < NM; mask++) {
      const low = mask & -mask, k = 31 - Math.clz32(low), r = mask ^ low;
      sV[mask] = sV[r] + P.M[k].V; sE[mask] = sE[r] + P.M[k].E; sVs[mask] = sVs[r] + P.M[k].Vs; sM[mask] = sM[r] + (+P.M[k].m || 0);
      const c = cascata(P, mask, false); C[mask] = c.pv; Cs[mask] = c.pvs; Q[mask] = c.qreg;
    }
    const f0 = new Float64Array(NM), f = new Float64Array(NM), v = new Float64Array(NM), A = new Float64Array(NM);
    for (let mask = 0; mask < NM; mask++) { f0[mask] = sV[mask] + C[mask]; f[mask] = f0[mask] + gamma * sE[mask]; A[mask] = sVs[mask] + Cs[mask]; }
    for (let mask = 0; mask < NM; mask++) {
      let b = f[mask];
      for (let m = mask; m; m &= m - 1) { const sub = mask ^ (m & -m); if (v[sub] > b) b = v[sub]; }
      v[mask] = b;
    }
    return { NM, sV, sE, sVs, sM, C, Cs, Q, f0, f, v, A };
  }

  const tstarDe = (Tb, mask) => Math.max(0, Tb.v[mask] - Tb.f[mask]);
  const maskDe = (P, ids) => ids.reduce((m, id) => (P.ids.indexOf(id) >= 0 ? m | (1 << P.ids.indexOf(id)) : m), 0);
  const idsDe = (P, mask) => P.ids.filter((_, i) => (mask >> i) & 1);

  /* núcleo: max Σ v(S) λ_S  s.a. Σ_{S∋k} λ_S = 1, λ ≥ 0 (dual de min Σy s.a. y(S) ≥ v(S)); base inicial = singletons */
  function nucleoLP(v, N) {
    const mem = []; for (let i = 0; i < 31; i++) if ((N >> i) & 1) mem.push(i);
    const r = mem.length; if (!r) return { min: 0, iter: 0 };
    const cols = []; for (let S = N; S; S = (S - 1) & N) cols.push(S);
    const nc = cols.length, w = nc + 1;
    const T = new Float64Array(r * w), c = new Float64Array(nc);
    cols.forEach((S, j) => { c[j] = v[S]; mem.forEach((k, i) => { if ((S >> k) & 1) T[i * w + j] = 1; }); });
    for (let i = 0; i < r; i++) T[i * w + nc] = 1;
    const basis = mem.map(k => cols.indexOf(1 << k));
    const tol = 1e-9 * (1 + Math.max(...Array.from(c).map(Math.abs)));
    let it = 0;
    while (it++ < 5000) {
      // custos reduzidos: d_j = c_j − Σ_i c_B(i) T[i][j]
      let ent = -1, best = tol;
      for (let j = 0; j < nc; j++) {
        let d = c[j]; for (let i = 0; i < r; i++) d -= c[basis[i]] * T[i * w + j];
        if (d > best) { best = d; ent = j; if (it > 200) break; }
      }
      if (ent < 0) break;
      let row = -1, ratio = Infinity;
      for (let i = 0; i < r; i++) { const a = T[i * w + ent]; if (a > 1e-12) { const q = T[i * w + nc] / a; if (q < ratio - 1e-12 || (Math.abs(q - ratio) <= 1e-12 && basis[i] < basis[row])) { ratio = q; row = i; } } }
      if (row < 0) break;
      const pv = T[row * w + ent];
      for (let j = 0; j < w; j++) T[row * w + j] /= pv;
      for (let i = 0; i < r; i++) if (i !== row) { const fct = T[i * w + ent]; if (fct) for (let j = 0; j < w; j++) T[i * w + j] -= fct * T[row * w + j]; }
      basis[row] = ent;
    }
    let obj = 0; for (let i = 0; i < r; i++) obj += c[basis[i]] * T[i * w + nc];
    return { min: obj, iter: it };
  }

  /* ------------------------------------------------------------ avaliação completa de um local
     opc: { gamma, sel:[ids], universo:[ids], obrig:[ids], maxTam, F, mbar, theta, Z0, regen, nucleo:true, curva:true, top:12 } */
  function avaliar(model, opc) {
    opc = Object.assign({ gamma: 0, theta: 1, Z0: 0, regen: false, nucleo: true, curva: true, top: 12, maxTam: 99 }, opc || {});
    const sel = opc.sel || [], uni = opc.universo || model.mods.map(m => m.id), obr = opc.obrig || [];
    const ativos = model.mods.map(m => m.id).filter(id => sel.includes(id) || uni.includes(id) || obr.includes(id));
    if (ativos.length > 16) throw new Error('No máximo 16 módulos ativos.');
    const P = preparar(model, ativos), Tb = tabelas(P, opc.gamma);
    const N = maskDe(P, sel), U = maskDe(P, uni) | maskDe(P, obr), O = maskDe(P, obr);
    const zeta = mask => (opc.Z0 > 0 ? Tb.Q[mask] / opc.Z0 : null);
    const limZ = 1 / (1 + opc.theta);
    const out = { ids: P.ids, sel, n: popc(N), gamma: opc.gamma, moeda: model.moeda };

    // --- agrupamento escolhido
    const T = tstarDe(Tb, N);
    const cas = cascata(P, N, true);
    const xN = N & P.M.reduce((m, md, i) => (md.V >= 0 ? m | (1 << i) : m), 0);
    Object.assign(out, {
      A: Tb.A[N], C: Tb.C[N], Cs: Tb.Cs[N], f: Tb.f[N], v: Tb.v[N], T, sV: Tb.sV[N], sE: Tb.sE[N], m: Tb.sM[N],
      tit: P.M.reduce((s, md, i) => s + (((N >> i) & 1) ? (+md.tit || 0) : 0), 0),
      deficits: P.M.reduce((s, md, i) => s + (((N >> i) & 1) ? Math.max(0, -(md.V + opc.gamma * md.E)) : 0), 0),
      fluxos: cas.fl, xN: idsDe(P, xN), A_N: Tb.A[xN], zeta: zeta(N),
    });
    out.E_N = out.A > 0 ? out.A_N / out.A : null;
    out.lamT = T > 1e-6 ? (out.A - out.A_N) / T : null;

    // λ_loc: fração da demanda de insumos de cascata atendida pelo próprio agrupamento; saídas sem destino
    const dem = {}, sup = {};
    model.links.forEach(l => {
      const j = P.ids.indexOf(l.para), i = P.ids.indexOf(l.de);
      if (j >= 0 && ((N >> j) & 1)) dem[l.tipo + '|' + j] = { D: +l.D || 0, tipo: l.tipo, para: l.para };
      if (i >= 0 && ((N >> i) & 1)) sup[l.tipo + '|' + i] = { S: +l.S || 0, tipo: l.tipo, de: l.de, un: l.un };
    });
    const fr = Object.entries(dem).filter(([, d]) => d.D > 0).map(([k, d]) => Math.min(1, (cas.ud[k] || 0) / d.D));
    out.lamLoc = fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : null;
    out.saidas = Object.entries(sup).map(([k, s]) => ({ tipo: s.tipo, de: s.de, un: s.un, S: s.S, usado: cas.us[k] || 0, sobra: Math.max(0, s.S - (cas.us[k] || 0)) }));

    // Shapley, benefício recebido, título por módulo
    const mem = []; for (let i = 0; i < P.n; i++) if ((N >> i) & 1) mem.push(i);
    const nN = mem.length, phi = {}, b = {}, t = {};
    mem.forEach(k => {
      const rest = N ^ (1 << k); let tot = 0;
      for (let S = rest; ; S = (S - 1) & rest) {
        const s = popc(S); tot += FACT[s] * FACT[nN - s - 1] / FACT[nN] * (Tb.v[S | (1 << k)] - Tb.v[S]);
        if (S === 0) break;
      }
      const id = P.ids[k]; phi[id] = tot;
      b[id] = cas.fl.filter(x => x.para === id).reduce((a, x) => a + x.vp, 0);
      t[id] = tot - (P.M[k].V + opc.gamma * P.M[k].E) - b[id];
    });
    let shapNucleo = true;
    for (let S = N; S; S = (S - 1) & N) {
      let sm = 0; for (const k of mem) if ((S >> k) & 1) sm += phi[P.ids[k]];
      if (sm < Tb.v[S] - 1e-6 * (1 + Math.abs(Tb.v[S]))) { shapNucleo = false; break; }
    }
    Object.assign(out, { phi, b, t, shapNucleo });
    if (opc.nucleo && nN) {
      const lp = nucleoLP(Tb.v, N);
      out.lpMin = lp.min; out.nucleoVazio = lp.min > Tb.v[N] + 1e-6 * (1 + Math.abs(Tb.v[N]));
      out.T_LP = Math.max(0, lp.min - Tb.f[N]);
    }

    // γ*: menor γ com f_γ(N) ≥ f_γ(R) para todo R ⊆ N (forma fechada; igual à bisseção do estudo)
    const gStar = () => {
      if (Math.max(0, Tb.v[N] - Tb.f[N]) <= 1e-6) return 0;
      let g = 0;
      for (let R = N; ; R = (R - 1) & N) {
        const d0 = Tb.f0[R] - Tb.f0[N], dE = Tb.sE[N] - Tb.sE[R];
        if (d0 > 0) { if (dE > 0) g = Math.max(g, d0 / dE); else return null; }
        if (R === 0) break;
      }
      return g <= 1 + 1e-9 ? Math.min(g, 1) : null;
    };
    // com γ ≠ 0 o γ* continua medido a partir de γ = 0
    out.gStar = nN ? gStar() : null;
    if (opc.curva && nN) {
      out.curva = [];
      for (let gi = 0; gi <= 20; gi++) {
        const g = gi / 20; let mx = -Infinity;
        for (let R = N; ; R = (R - 1) & N) { const val = Tb.f0[R] + g * Tb.sE[R]; if (val > mx) mx = val; if (R === 0) break; }
        out.curva.push({ g, T: Math.max(0, mx - (Tb.f0[N] + g * Tb.sE[N])) });
      }
    }

    // --- busca do equilíbrio azul xᴬ
    const F = opc.F == null ? T : +opc.F, mbar = opc.mbar == null ? out.m : +opc.mbar;
    const cand = [];
    let best = null;
    for (let X = U; X; X = (X - 1) & U) {
      if ((X & O) !== O) continue;
      if (popc(X) > opc.maxTam) continue;
      const TX = tstarDe(Tb, X), mX = Tb.sM[X], zX = zeta(X);
      const falha = [];
      if (TX > F + 1e-6) falha.push('T* > F');
      if (mX < mbar - 1e-9) falha.push('Σm < m̄');
      if (opc.regen && opc.Z0 > 0 && zX < limZ - 1e-12) falha.push('ζ < 1/(1+θ)');
      const c = { mask: X, ids: idsDe(P, X), A: Tb.A[X], T: TX, m: mX, zeta: zX, ok: !falha.length, falha };
      cand.push(c);
      if (c.ok && (!best || c.A > best.A + 1e-6 || (Math.abs(c.A - best.A) <= 1e-6 && X === N))) best = c;
    }
    cand.sort((a, b) => b.A - a.A);
    out.F = F; out.mbar = mbar; out.limZ = limZ;
    out.xA = best; out.igual = !!best && best.mask === N;
    out.top = cand.slice(0, opc.top);
    out.topOk = cand.filter(c => c.ok).slice(0, opc.top);
    out.excluidos = cand.filter(c => !c.ok && (!best || c.A > best.A + 1e-6)).slice(0, opc.top);
    out.nViaveis = cand.filter(c => c.ok).length; out.nCand = cand.length;
    out.lancavel = T <= F + 1e-6;
    return out;
  }

  return { af, PADRAO, M3_CO2, linksPais, modeloPais, preparar, cascata, tabelas, nucleoLP, avaliar, popc };
});
