# BIZSYS WebAR — contrato do design system

Este documento é a fonte de verdade para interfaces da aplicação. O catálogo
visual navegável fica em `/design-system.html` e usa exatamente os mesmos
arquivos CSS da experiência AR.

## Princípios

1. Croma zero na interface: a cor pertence ao feed da câmera e ao conteúdo 3D.
2. Centro livre: controles e mensagens permanecem nas bordas seguras.
3. Todo alvo de toque sobre a câmera mede pelo menos 44 × 44px.
4. Texto sobre vídeo sempre recebe vidro dessaturado ou scrim.
5. Animações comunicam estado ou resposta ao toque; não são decorativas.
6. Estados nunca dependem apenas de cor: texto, forma, opacidade e movimento
   trabalham em conjunto.

## Estrutura

```text
src/styles/design-system/
├── fonts.css       # fontes Fontsource empacotadas localmente
├── tokens.css      # rampa, tokens semânticos, tema dark e .light
├── base.css        # reset e comportamentos globais
├── utilities.css   # glass, scrim, grid, mono e motion
├── components.css  # primitivas públicas
├── index.css       # entrada compartilhada
└── catalog.css     # composição exclusiva do catálogo
```

`src/styles/global.css` adiciona somente as camadas específicas da experiência:
shell/status, captura e diagnóstico. Componentes futuros devem consumir a
fundação compartilhada antes de criar estilos locais.

## Tokens públicos

- rampa: `--gray-0` a `--gray-8`;
- superfícies: `--background`, `--surface`, `--surface-2`, `--card`, `--hud`;
- conteúdo: `--foreground`, `--muted-foreground`, `--primary`;
- interação: `--border`, `--border-strong`, `--input`, `--ring`;
- layout: `--space-*`, `--radius-*`, `--touch-target`, `--safe-*`;
- efeitos: `--shadow-hud`, `--gradient-scrim`, `--gradient-ambient`;
- tipografia: `--font-display` e `--font-mono`.

O tema dark é o padrão. A classe `.light` troca apenas tokens semânticos e é
destinada a páginas futuras e ao catálogo; a sessão AR permanece dark.

## Componentes públicos

| Contrato | Uso |
| --- | --- |
| `.ds-button` | ação primária arredondada |
| `.ds-button--outline` | ação secundária |
| `.ds-button--ghost` | ação de baixa ênfase |
| `.ds-icon-button` | ação circular com ícone e label acessível |
| `.ds-pill` / `.ds-badge` | status curto em IBM Plex Mono |
| `.ds-panel` | card ou bloco documental |
| `.ds-sheet` | base reutilizável de bottom sheet |
| `.ds-field` | label e controle de formulário |
| `.ds-glass` | superfície sobre câmera, blur e saturação zero |
| `.ds-scrim` | gradiente que protege contraste sobre vídeo |
| `.ds-mark-label` | label de marca em caixa alta e tracking amplo |

Modificadores devem ser combinados com a classe base. Elementos específicos da
experiência podem usar seletores próprios, mas seus valores de cor, espaço,
tipografia e movimento devem vir dos tokens.

## Marca e tipografia

- Space Grotesk variável cobre pesos 400–600.
- IBM Plex Mono usa pesos 400 e 500 para labels, estados e diagnóstico.
- Ambas são distribuídas via Fontsource e servidas como WOFF2 pelo próprio
  build, sem requisição externa.
- As licenças OFL ficam em `public/licenses/fonts/`.
- Wordmark branco e símbolo branco são usados no dark; o wordmark preto fica
  reservado ao tema claro do catálogo.

Não altere proporção, recorte ou cores dos PNGs da BIZSYS.

## Acessibilidade e motion

- contraste de texto mínimo de 4.5:1;
- foco visível com `--ring` e offset de 3px;
- SVGs decorativos usam `aria-hidden`; icon buttons exigem `aria-label`;
- safe areas usam `env(safe-area-inset-*)`;
- `prefers-reduced-motion` reduz animações e transições;
- ícones usam traço 1.25px, linecap e linejoin arredondados;
- mensagens continuam ligadas aos estados reais de `ARPhase`, sem inventar
  telemetria ou capacidades de tracking.

## Checklist de contribuição

- [ ] O componente usa somente tokens semânticos para cores.
- [ ] Funciona em dark e, quando aplicável, em `.light`.
- [ ] Mantém 44px de área de toque sobre câmera.
- [ ] Não ocupa o centro do enquadramento sem necessidade funcional.
- [ ] Possui foco visível, nome acessível e estado não dependente apenas de cor.
- [ ] Respeita reduced motion e safe areas.
- [ ] Foi adicionado ao catálogo quando cria um novo contrato reutilizável.
- [ ] `npm run test:run` e `npm run build` continuam aprovados.

## Referências

- referência visual original: `bizsys-webar-design-system.html`;
- guia original: `bizsys-webar-design-system.md`;
- adoção nesta codebase: 13 de agosto de 2026.
