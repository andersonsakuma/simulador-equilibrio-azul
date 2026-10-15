/* Confere o motor em JavaScript com os resultados do motor em Python do estudo (testes/referencia_python.json).
   Uso: node testes/teste_motor.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const Engine = require('../assets/js/engine.js');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/data/dados.js'), 'utf8'), ctx);
const DADOS = ctx.window.DADOS;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'referencia_python.json'), 'utf8'));

let falhas = 0, testes = 0;
const perto = (a, b, tol = 1e-6) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= tol * (1 + Math.abs(b)));
function confere(nome, a, b, tol) { testes++; if (!perto(a, b, tol)) { falhas++; if (falhas <= 25) console.log('  DIFERENÇA', nome, a, b); } }
function confereIgual(nome, a, b) { testes++; if (JSON.stringify(a) !== JSON.stringify(b)) { falhas++; if (falhas <= 25) console.log('  DIFERENÇA', nome, a, b); } }

function avaliaLote(pais, prm, opc) {
  const model = Engine.modeloPais(pais, DADOS, prm, opc);
  const lote = pais.mods.filter(m => m.lote).map(m => m.id).sort((a, b) => +a.slice(1) - +b.slice(1));
  const need13 = lote.includes('M13');
  const uni = pais.mods.filter(m => m.apl !== 'Não' && m.id !== 'M13').map(m => m.id).concat(need13 ? ['M13'] : []);
  return { lote, r: Engine.avaliar(model, { gamma: (opc && opc.gamma) || 0, sel: lote, universo: uni, obrig: need13 ? ['M13'] : [], maxTam: lote.length }) };
}

console.log('1. Lotes dos 101 países (γ = 0, CO2 a 335 USD/t)');
let tot = { T: 0, Dmod: 0, A: 0, AN: 0, igual: 0, nuc: 0, lp: 0 };
const t0 = Date.now();
REF.paises.forEach(ref => {
  const pais = DADOS.paises.find(p => p.nome === ref.pais);
  const { lote, r } = avaliaLote(pais);
  const n = ref.pais;
  confereIgual(n + ' lote', lote, ref.lote);
  confere(n + ' T*', r.T, ref.T); confere(n + ' v(N)', r.v, ref.vN); confere(n + ' f(N)', r.f, ref.fN);
  confere(n + ' títulos Bolsa', r.tit, ref.Dmod); confere(n + ' 𝒜', r.A, ref.A_lot); confere(n + ' 𝒜(xᴺ)', r.A_N, ref.A_N);
  confere(n + ' Eᴺ', r.E_N, ref.E_N); confere(n + ' λ_T', r.lamT, ref.lam_T); confere(n + ' γ*', r.gStar, ref.gamma_star, 1e-6);
  confere(n + ' C', r.C, ref.C_lot); confere(n + ' λ_loc', r.lamLoc, ref.lam_loc); confere(n + ' mínimo do núcleo (PL)', r.lpMin, ref.lpmin, 1e-6);
  Object.keys(ref.shapley).forEach(k => confere(n + ' φ ' + k, r.phi[k], ref.shapley[k]));
  const sob = {}; r.saidas.forEach(s => { sob[(s.tipo + ' do ' + s.de)] = s.sobra; });
  Object.keys(ref.sobra).forEach(k => confere(n + ' sobra ' + k, sob[k], ref.sobra[k]));
  const xA = r.xA ? r.xA.ids.slice().sort((a, b) => +a.slice(1) - +b.slice(1)) : null;
  confereIgual(n + ' xᴬ', xA, ref.xA); confere(n + ' 𝒜(xᴬ)', r.xA && r.xA.A, ref.A_xA); confere(n + ' T*(xᴬ)', r.xA && r.xA.T, ref.T_xA);
  confereIgual(n + ' lote = equilíbrio', r.igual, ref.igual);
  tot.T += r.T; tot.Dmod += r.tit; tot.A += r.A; tot.AN += r.A_N; tot.igual += r.igual ? 1 : 0; tot.nuc += r.shapNucleo ? 1 : 0; tot.lp += r.nucleoVazio ? 0 : 1;
});
console.log(`   ${REF.paises.length} países em ${Date.now() - t0} ms`);
confere('Σ T*', tot.T, REF.agg.T); confere('Σ títulos', tot.Dmod, REF.agg.Dmod); confere('Σ 𝒜', tot.A, REF.agg.A_lot); confere('Σ 𝒜(xᴺ)', tot.AN, REF.agg.A_N);
confereIgual('lotes que já são o equilíbrio', tot.igual, REF.agg.lote_e_equilibrio);
confereIgual('Shapley no núcleo', tot.nuc, REF.agg.shapley_no_nucleo); confereIgual('núcleo não vazio', tot.lp, REF.agg.lp_igual);
console.log('   Σ T* =', tot.T.toFixed(0), '| Σ títulos =', tot.Dmod.toFixed(0), '| lotes = equilíbrio:', tot.igual);

console.log('2. Curva T*(γ) e sensibilidade ao preço do CO2');
REF.curve.forEach(c => {
  let s = 0; DADOS.paises.forEach(p => { s += avaliaLote(p, {}, { gamma: c.gamma }).r.T; });
  confere('T*(γ=' + c.gamma + ')', s, c.T);
});
REF.sens.forEach(c => {
  let s = 0; DADOS.paises.forEach(p => { s += avaliaLote(p, { p_co2: c.p_co2 }).r.T; });
  confere('T* com CO2 a ' + c.p_co2, s, c.T);
});

console.log('3. Cenário: calor do biodigestor para a cervejaria');
let Tc = 0, Ac = 0; DADOS.paises.forEach(p => { const { r } = avaliaLote(p, {}, { calor: true }); Tc += r.T; Ac += r.A; });
confere('T* com calor', Tc, REF.calor.T_calor); confere('𝒜 com calor', Ac, REF.calor.A_calor);

console.log('4. Biossistema de Garuva (exemplo ilustrativo da Parte III)');
const G = REF.garuva;
const gmodel = { nome: 'Garuva', moeda: 'R$ mil', taxa: G.taxa, tsoc: G.taxa, W: 1,
  mods: Object.entries(G.mod).map(([id, m]) => ({ id, nome: m.nome, V: m.V, E: m.E, Vs: m.V + m.E, TRL: m.TRL, m: m.m, vida: G.vida, car: 0, apl: 'Sim' })),
  links: G.links.map(l => ({ tipo: l[0], de: l[1], para: l[2], S: l[3], D: l[4], u: l[5], p: l[6], un: l[7], regen: l[0] === 'digestato' })) };
const ids = ['G1', 'G2', 'G3', 'G4'];
const rg = Engine.avaliar(gmodel, { sel: ids, universo: ids, F: G.F, mbar: G.mbar, theta: G.theta, Z0: G.z0, regen: true, top: 20 });
confere('Garuva T*', rg.T, G.g4.T); confere('Garuva 𝒜', rg.A, G.g4.A); confere('Garuva C', rg.C, G.g4.C);
confere('Garuva Eᴺ', rg.E_N, G.g4.EN); confere('Garuva λ_T', rg.lamT, G.g4.lamT); confere('Garuva γ*', rg.gStar, G.g4.gstar, 1e-6);
confere('Garuva ζ', rg.zeta, G.g4.zeta);
ids.forEach(k => { confere('Garuva φ ' + k, rg.phi[k], G.g4.phi[k]); confere('Garuva t ' + k, rg.t[k], G.g4.t[k]); });
confereIgual('Garuva xᴬ', rg.xA.ids, ids);
G.cands.forEach(c => {
  const x = rg.top.find(y => y.ids.join(', ') === c.R);
  if (!x) { testes++; falhas++; console.log('  FALTA candidato', c.R); return; }
  confere('Garuva 𝒜 ' + c.R, x.A, c.A); confere('Garuva T* ' + c.R, x.T, c.T); confereIgual('Garuva ok ' + c.R, x.ok, c.ok);
});

console.log(`\n${testes} conferências, ${falhas} diferenças.`);
process.exit(falhas ? 1 : 0);
