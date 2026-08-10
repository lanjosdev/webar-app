# Placement horizontal com 8th Wall e Three.js

## Objetivo

Permitir que o usuário posicione e reposicione um único cubo sobre o chão
horizontal mantido pelo 8th Wall World Tracking. O cubo começa oculto, o
retículo central indica uma posição válida e um toque no canvas confirma o
ponto.

## Técnica adotada

O controller de placement cria:

- um `THREE.PlaneGeometry` invisível de `100 × 100`, rotacionado sobre `Y = 0`;
- um `THREE.Raycaster` com origem no centro da câmera, NDC `(0, 0)`;
- distância máxima de interseção de 20 unidades da cena;
- um `THREE.RingGeometry` turquesa como retículo;
- um listener `pointerup` primário para confirmar a posição atual.

O raycast roda somente quando o tracking está `NORMAL`. O retículo fica oculto
quando não existe interseção ou quando o tracking está `LIMITED`. Um toque válido
copia `X/Z` da interseção para o cubo e soma metade da altura no eixo `Y`,
mantendo sua base sobre o chão.

`Raycaster`, coordenadas, ponto de placement e array de interseções são
reutilizados para evitar alocações por frame. O listener, plano, retículo,
geometrias e materiais são removidos no `dispose()` da sessão.

## Fontes e versões

| Item | Versão/data | Uso | Fonte |
| --- | --- | --- | --- |
| 8th Wall Engine Binary | `1.0.0` | World Tracking e câmera | [Engine Overview](https://8thwall.org/docs/engine/overview) |
| Ground level | Consultado em 10/08/2026 | Confirmar chão em `Y = 0` | [World Effects](https://8thwall.org/docs/studio/guides/xr/world) |
| World Tracking | Consultado em 10/08/2026 | Confirmar um único plano horizontal dinâmico | [World Tracking Issues](https://8thwall.org/docs/troubleshooting/world-tracking-issues) |
| Exemplo oficial Three.js | Repositório oficial arquivado em 2026 | Validar raycast contra `PlaneGeometry` | [Tap to Place](https://github.com/8thwall/web/tree/master/examples/threejs/placeground) |
| Three.js | `0.185.1` | `Raycaster`, plano e retículo | [Raycaster](https://threejs.org/docs/pages/Raycaster.html) |

O exemplo `Tap to Place` pertence ao repositório oficial arquivado e não é usado
como fonte isolada. A técnica foi confrontada com a documentação atual de
`Y = 0` e com a API atual do Three.js.

## Fluxo de estado

```text
tracking INITIALIZING/LIMITED
    → placement desabilitado
    → retículo oculto

tracking NORMAL + interseção central
    → retículo visível
    → toque posiciona ou reposiciona o cubo
    → placement = placed

tracking LIMITED após placement
    → cubo preservado
    → retículo oculto
    → novos toques ignorados
```

Tracking e placement são estados independentes. Reiniciar a sessão volta o
placement para `not-placed` e recria um único listener.

## Roteiro de validação móvel

Executar três vezes em Android/Chrome e iPhone/Safari:

1. Iniciar AR e confirmar que o cubo permanece oculto antes do toque.
2. Mirar acima do horizonte e confirmar que o retículo não aparece.
3. Mirar no chão e confirmar que o retículo aparece no centro.
4. Tocar no canvas e confirmar que o cubo aparece com a base no retículo.
5. Mirar em outro ponto e tocar novamente; o mesmo cubo deve mover, sem duplicar.
6. Forçar tracking `LIMITED`; o retículo deve sumir e o cubo deve permanecer.
7. Tocar durante `LIMITED`; a posição não deve mudar.
8. Recuperar `NORMAL`; o retículo deve voltar e o reposicionamento deve funcionar.
9. Girar retrato/paisagem e confirmar alinhamento do raycast e do canvas.
10. Recarregar/reiniciar e confirmar ausência de placement e listeners antigos.

## Limitações

- apenas o plano horizontal `Y = 0`;
- nenhuma parede, mesa ou plano independente;
- nenhuma persistência ou anchor entre sessões;
- escala `responsive`, sem garantia de metros reais;
- sem recenter, rotação, escala por gesto, GLB ou múltiplos objetos;
- o plano invisível é uma superfície virtual para raycasting, não plane detection.
