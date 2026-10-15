/* Conferência das traduções: toda chave usada nas páginas e nos scripts existe em PT, EN e ES,
   com os mesmos marcadores {x}; países, macrorregiões, leituras e módulos têm nome nos três idiomas.
   Uso: node testes/teste_i18n.js */
'use strict';
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const def = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
def('window', {}); def('location', { search: '', href: 'http://x/' }); def('navigator', { language: 'pt-BR' });
def('document', { readyState: 'loading', addEventListener() {}, dispatchEvent() {}, querySelectorAll: () => [], getElementById: () => null, documentElement: { dataset: {} } });
def('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
require(path.join(raiz, 'assets/js/i18n.js'));
require(path.join(raiz, 'assets/data/dados.js'));
const I = window.I18N, D = window.DADOS;
let n = 0, erros = [];
const ok = (c, msg) => { n++; if (!c) erros.push(msg); };

const usadas = new Set();
['index.html', 'simulador.html', 'dashboard.html'].forEach(f => {
  const h = fs.readFileSync(path.join(raiz, f), 'utf8');
  for (const m of h.matchAll(/data-i="([^"]+)"/g)) usadas.add(m[1]);
  for (const m of h.matchAll(/data-ia="([^"]+)"/g)) m[1].split('|').forEach(p => usadas.add(p.split('=')[1]));
  for (const m of h.matchAll(/data-title="([^"]+)"/g)) usadas.add(m[1]);
});
['app.js', 'landing.js', 'dashboard.js', 'estado.js', 'charts.js', 'i18n.js'].forEach(f => {
  const s = fs.readFileSync(path.join(raiz, 'assets/js', f), 'utf8');
  for (const m of s.matchAll(/\bt\('([\w.]+)'/g)) if (!m[1].endsWith('.')) usadas.add(m[1]); // prefixos completados no código ficam na lista abaixo
  for (const m of s.matchAll(/t\((\w+) \? '([\w.]+)' : '([\w.]+)'\)/g)) { usadas.add(m[2]); usadas.add(m[3]); }
});
// chaves montadas no código
['tema.auto', 'tema.light', 'tema.dark', 'mod.h.sel', 'mod.h.busca', 'mod.h.obrig', 'chip.nin', 'chip.nout', 'chip.igual', 'chip.melhor', 'chip.nada', 'part.in', 'part.out',
 'mod.sub.pais', 'mod.sub.local', 'f.bolsa', 'f.ref', 'land.s3.r', 'land.s3.r.eq', 'land.s4.sim', 'land.s4.nao', 'land.s5.in', 'land.s5.out', 'xa.eq', 'xa.ok']
  .forEach(k => usadas.add(k));
for (let i = 1; i <= 4; i++) ['garuva.G', 'garuva.s.G'].forEach(p => usadas.add(p + i));
['T', 'A', 'lamT', 'EN', 'g', 'dif'].forEach(k => usadas.add('dash.met.' + k));

const marc = s => (s.match(/\{\w+\}/g) || []).sort().join(',');
usadas.forEach(k => {
  const e = I.S[k];
  ok(!!e, 'chave ausente: ' + k);
  if (!e) return;
  ok(e.length === 3 && e.every(x => typeof x === 'string' && x.trim()), 'tradução vazia: ' + k);
  ok(marc(e[1]) === marc(e[0]) && marc(e[2]) === marc(e[0]), 'marcadores diferentes: ' + k);
});
Object.keys(I.S).forEach(k => { const e = I.S[k]; ok(marc(e[1]) === marc(e[0]) && marc(e[2]) === marc(e[0]), 'marcadores diferentes: ' + k); });
D.paises.forEach(p => {
  const e = I.N.p[p.nome];
  ok(e && e[0] && e[1] && /^[A-Z]{3}$/.test(e[2]), 'país sem tradução ou ISO: ' + p.nome);
  ok(I.N.mac[p.macro], 'macrorregião sem tradução: ' + p.macro);
  ok(I.N.lei[p.leitura], 'leitura sem tradução: ' + p.leitura);
});
const isos = D.paises.map(p => I.N.p[p.nome] && I.N.p[p.nome][2]);
ok(new Set(isos).size === isos.length, 'código ISO repetido');
Object.keys(D.modulos).forEach(id => ok(I.N.mod[id] && I.N.mod[id][0] && I.N.mod[id][1], 'módulo sem tradução: ' + id));
['calor', 'CO2', 'substrato', 'digestato', 'restos', 'larva', 'água'].forEach(f => ok(I.N.flx[f], 'fluxo sem tradução: ' + f));
// formatação por idioma
const amostra = { pt: '1.234,5', en: '1,234.5', es: '1234,5' };
['pt', 'en', 'es'].forEach(l => { I.setLang(l); ok(I.num(1234.5, 1) === amostra[l], `formato ${l}: ${I.num(1234.5, 1)}`); });

console.log(`${n} conferências, ${usadas.size} chaves usadas, ${Object.keys(I.S).length} no dicionário, ${erros.length} problemas`);
if (erros.length) { console.log(erros.slice(0, 40).join('\n')); process.exit(1); }
