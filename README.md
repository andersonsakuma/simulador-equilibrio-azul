# Equilíbrio Azul — página inicial, simulador e dashboard

Site estático da **Equação do Equilíbrio Azul** (metodologia ZERI e Economia Azul), em português, inglês e espanhol. Roda inteiro no navegador, sem servidor, e está publicado no GitHub Pages: https://andersonsakuma.github.io/simulador-equilibrio-azul/

*EN — Static site for the Blue Equilibrium Equation (ZERI and Blue Economy) in Portuguese, English and Spanish: home page with a live step-by-step demonstration, simulator for the 101 countries of the ZERI Blue Exchange or any new site, and dashboard. Add `?lang=en` to any address.*

*ES — Sitio estático de la Ecuación del Equilibrio Azul (ZERI y Economía Azul) en portugués, inglés y español: página de inicio con demostración paso a paso en vivo, simulador para los 101 países de la Bolsa Azul ZERI o cualquier sitio nuevo, y dashboard. Agregue `?lang=es` a cualquier dirección.*

## Páginas

- **Início** (`index.html`): o que é a equação, os números da Bolsa Azul ZERI e a demonstração passo a passo das sete partes da equação com o biossistema de Garuva (valores ilustrativos). Os módulos podem ser marcados e desmarcados, inclusive no diagrama, e γ pode ser alterado: todos os números são calculados na hora pelo motor.
- **Simulador** (`simulador.html`): país do estudo (101 países × 13 módulos) ou local novo (módulos, fluxos, taxas e moeda editáveis, com exportação e importação em JSON). Calcula 𝒜, C(x), T*, Shapley e título por módulo, núcleo por programação linear, Eᴺ, λ_T, γ* e o equilíbrio azul xᴬ. A aba Ranking avalia os 101 lotes.
- **Dashboard** (`dashboard.html`): panorama dos 101 lotes recalculado com γ, preço do CO₂ e cenário de calor escolhidos (mapa por macrorregião, título por macrorregião, título total conforme γ, distribuição de γ*, valor azul × título, lotes com agrupamento melhor) e painel do local aberto no simulador.

Links antigos do tipo `index.html#pais=Etiópia` continuam funcionando: a página inicial os encaminha ao simulador.

## Idiomas

O seletor PT · EN · ES fica no topo de todas as páginas; a escolha fica salva no navegador. O idioma também pode vir no endereço (`?lang=pt`, `?lang=en`, `?lang=es`). Sem escolha salva, vale o idioma do navegador (inglês para os demais). Números seguem o padrão de cada idioma. Os textos estão em `assets/js/i18n.js`, gerado a partir dos dicionários do projeto.

## Publicação

**Settings → Pages → Deploy from a branch**, branch `main`, pasta `/ (root)`. Cada alteração enviada à branch `main` atualiza o site em um ou dois minutos. Para usar sem publicar, abra `index.html` direto no navegador. As fontes vêm do Google Fonts e o estilo das equações do KaTeX (jsDelivr); sem internet, o site funciona com as fontes do sistema.

## Estrutura

```
index.html                 página inicial e demonstração passo a passo
simulador.html             simulador e ranking dos 101 países
dashboard.html             dashboard (101 países e local em análise)
assets/js/i18n.js          textos PT/EN/ES, formatação de números, nomes de países e módulos, tema
assets/js/engine.js        motor da equação (mesma lógica do motor em Python do estudo)
assets/js/estado.js        estado salvo do simulador e montagem do modelo (simulador e dashboard)
assets/js/app.js           interface do simulador
assets/js/landing.js       demonstração da página inicial
assets/js/dashboard.js     dashboard
assets/js/charts.js        gráficos em SVG
assets/data/dados.js       101 países × 13 módulos (estudo ZERI LAB)
assets/css/style.css       estilo (claro e escuro)
testes/teste_motor.js      conferência do motor JS contra o motor em Python
testes/teste_i18n.js       conferência das traduções
```

## Testes

```
node testes/teste_motor.js
node testes/teste_i18n.js
```

O primeiro faz 2.439 conferências contra os resultados do motor em Python (`testes/referencia_python.json`): os 101 lotes (T*, 𝒜, Eᴺ, λ_T, γ*, Shapley, mínimo do núcleo, saídas sem destino, equilíbrio azul), a curva de T* por γ, a sensibilidade ao preço do CO₂, o cenário de calor e o exemplo de Garuva. O segundo confere que toda chave de texto usada nas páginas existe em PT, EN e ES com os mesmos marcadores, e que países, macrorregiões e módulos têm nome nos três idiomas. Resultado esperado: 0 diferenças e 0 problemas. Requer Node 18 ou mais recente.

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
