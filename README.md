# Simulador do Equilíbrio Azul

Página estática que avalia qualquer local pela **Equação do Equilíbrio Azul** (metodologia ZERI e Economia Azul). Roda inteira no navegador, sem servidor, e está publicada no GitHub Pages. As fontes vêm do Google Fonts e o estilo das equações do KaTeX (jsDelivr); sem internet, a página continua funcionando com as fontes do sistema.

- **País do estudo:** os 101 países da Bolsa Azul ZERI, com os 13 módulos de cada um (dados do estudo ZERI LAB).
- **Local novo:** cadastro livre de módulos, fluxos de cascata, taxas e moeda. Vem com o exemplo ilustrativo do biossistema de Garuva (SC) e permite copiar um país para editar.
- **Ranking:** avalia os 101 lotes de uma vez com os preços e o γ escolhidos.

Para o agrupamento marcado, o simulador calcula o valor azul 𝒜, a cascata ZERI C(x), o título social T*, a partilha de Shapley e o título por módulo, o teste do núcleo por programação linear, Eᴺ, λ_T e γ*. Também procura o equilíbrio azul xᴬ: entre todos os agrupamentos possíveis, o de maior valor azul que cabe na doação F, atende o mínimo de necessidades básicas m̄ e, quando Z₀ é informado, regenera o ambiente.

## Publicar no GitHub Pages

Endereço: https://andersonsakuma.github.io/simulador-equilibrio-azul/

A publicação usa **Settings → Pages → Deploy from a branch**, branch `main`, pasta `/ (root)`. Cada alteração enviada à branch `main` atualiza a página em um ou dois minutos.

## Usar sem publicar

Abra `index.html` direto no navegador. Os dados estão em um arquivo JavaScript, e não em JSON, para a página funcionar também sem servidor.

O documento da equação (PDF e HTML) e a planilha `Equilibrio_Azul_Bolsa_ZERI.xlsx` acompanham este simulador no projeto ZERI LAB.

## Estrutura

```
index.html                 página (equações já renderizadas)
assets/js/engine.js        motor da equação (mesma lógica do motor em Python do estudo)
assets/js/app.js           interface
assets/js/charts.js        gráficos em SVG
assets/data/dados.js       101 países × 13 módulos (estudo ZERI LAB)
assets/css/style.css       estilo
testes/teste_motor.js      conferência do motor JS contra o motor em Python
```

## Testes

```
node testes/teste_motor.js
```

São 2.439 conferências contra os resultados do motor em Python (`testes/referencia_python.json`): os 101 lotes (T*, 𝒜, Eᴺ, λ_T, γ*, Shapley, mínimo do núcleo, saídas sem destino, equilíbrio azul), a curva de T* por γ, a sensibilidade ao preço do CO₂, o cenário de calor do biodigestor para a cervejaria e o exemplo de Garuva. Resultado esperado: 0 diferenças. Requer Node 18 ou mais recente.

## Formato de um local (importar e exportar)

```json
{
  "nome": "Biossistema de Garuva (SC)", "moeda": "R$ mil", "taxa": 0.10, "tsoc": 0.10, "W": 1,
  "mods": [ { "id": "G1", "nome": "Biodigestor e gerador", "V": 150, "E": 200, "TRL": 9, "m": 2, "vida": 10, "car": 0 } ],
  "links": [ { "tipo": "digestato", "de": "G1", "para": "G4", "S": 2500, "D": 1500, "u": 0.015, "p": 0, "un": "m³/a", "regen": true } ],
  "cfg": { "sel": ["G1"], "busca": ["G1"], "obrig": [], "Fmodo": "valor", "Fval": 35, "mmodo": "valor", "mval": 6, "tmodo": "livre", "regen": true, "Z0": 2500, "theta": 1, "gamma": 0 }
}
```

- `V`: VPL financeiro do módulo sozinho. `E`: valor social além do financeiro (VPL social − V). `m`: prioridade de necessidade básica. `TRL`: 1 a 9. `vida` e `car` (carência) em anos.
- `S` e `D`: oferta do fornecedor e demanda do receptor por ano. `u`: custo que o receptor deixa de pagar por unidade. `p`: preço que o fornecedor já recebe por ela. `regen`: o fluxo dá destino ao resíduo do território e entra em ζ.
- No máximo 16 módulos por local.

## Limites

- Os dados dos países vêm do estudo ZERI LAB: estimativa classe 5 (±50%), USD de 2026. O preço do CO₂ (335 USD/t) é hipótese a cotar no local.
- ψ = TRL/9 é uma aproximação do risco do elo, não uma probabilidade calibrada.
- Os valores de Garuva são ilustrativos, de ordem de grandeza.
- A equação é estática e é uma proposta deste trabalho, ainda sem revisão por pares.

## Autoria

Anderson Sakuma — Pesquisador Rede ZERI Brasil / PPGTE-UTFPR / ApoloLab / IPÊ-FIS. Curitiba, outubro de 2026.
