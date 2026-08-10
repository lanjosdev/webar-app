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
- um retículo HTML/CSS turquesa em screen-space, fixado em `50% × 50%` da viewport;
- um listener `pointerup` primário para confirmar a posição atual.

O raycast roda somente quando o tracking está `NORMAL`. O retículo fica oculto
quando não existe interseção ou quando o tracking está `LIMITED`. Um toque válido
copia `X/Z` da interseção para o cubo e soma metade da altura no eixo `Y`,
mantendo sua base sobre o chão.

`Raycaster`, coordenadas, ponto de placement, vetores de projeção e array de
interseções são reutilizados para evitar alocações Three.js por frame. O listener
e o plano são removidos, os recursos Three.js são liberados e o retículo é
ocultado no `dispose()` da sessão.

O retículo visual não é um objeto no mundo 3D. Essa separação é intencional: a
projeção óptica controlada pelo XR8 pode deslocar visualmente uma geometria 3D,
enquanto o overlay em screen-space garante o centro da interface. Para preservar
o feedback de perspectiva, dois diâmetros do anel horizontal são projetados pela
câmera a cada frame; seus eixos determinam a escala e a rotação da elipse da UI.
A posição do cubo continua sendo calculada pelo raio central contra o chão virtual.
Antes do raycast, o centro do drawing buffer é convertido para NDC usando o
viewport real do contexto WebGL (`gl.VIEWPORT`), evitando assumir que `(0, 0)`
representa o centro visual após o recorte fullscreen. A leitura não depende do
cache interno de `WebGLRenderer`, pois o Engine Binary também chama
`gl.viewport()` diretamente.

O drawing buffer pode ter resolução diferente da viewport, mas sua caixa CSS
deve ocupar exatamente a área visível. Como o XR8 escreve dimensões inline no
canvas, `width` e `height` visuais são forçados para `100%` com `!important`; os
atributos `canvas.width` e `canvas.height` continuam controlando somente a
resolução interna.

O `pointerup` não copia diretamente o último ponto calculado. Ele registra uma
solicitação, confirmada no próximo `Scene.onBeforeRender` depois de recalcular a
interseção. A matriz do cubo é atualizada no mesmo callback, garantindo que seu
primeiro frame use exatamente a pose de câmera que gerou o placement.

`Intersection.point` é tratado como world-space. Antes de escrever em
`target.position`, o centro desejado do cubo é convertido com
`target.parent.worldToLocal()`, pois `Object3D.position` pertence ao espaço local
do pai e a hierarquia dirigida pelo XR8 não deve ser presumida como identidade.

## Fontes e versões

| Item | Versão/data | Uso | Fonte |
| --- | --- | --- | --- |
| 8th Wall Engine Binary | `1.0.0` | World Tracking e câmera | [Engine Overview](https://8thwall.org/docs/engine/overview) |
| Ground level | Consultado em 10/08/2026 | Confirmar chão em `Y = 0` | [World Effects](https://8thwall.org/docs/studio/guides/xr/world) |
| World Tracking | Consultado em 10/08/2026 | Confirmar um único plano horizontal dinâmico | [World Tracking Issues](https://8thwall.org/docs/troubleshooting/world-tracking-issues) |
| Exemplo oficial Three.js | Repositório oficial arquivado em 2026 | Validar raycast contra `PlaneGeometry` | [Tap to Place](https://github.com/8thwall/web/tree/master/examples/threejs/placeground) |
| Three.js | `0.185.1` | `Raycaster` e plano virtual | [Raycaster](https://threejs.org/docs/pages/Raycaster.html) |
| WebGL / Three.js | `0.185.1` | Conversão drawing buffer/viewport real | [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) |

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
4. Tocar no canvas e confirmar que o cubo aparece no ponto da interseção central.
5. Mirar em outro ponto e tocar novamente; o mesmo cubo deve mover, sem duplicar.
6. Forçar tracking `LIMITED`; o retículo deve sumir e o cubo deve permanecer.
7. Tocar durante `LIMITED`; a posição não deve mudar.
8. Recuperar `NORMAL`; o retículo deve voltar e o reposicionamento deve funcionar.
9. Girar retrato/paisagem e confirmar alinhamento do raycast e do canvas.
10. Recarregar/reiniciar e confirmar ausência de placement e listeners antigos.

## Resultado registrado

Em 10/08/2026, o placement central e o reposicionamento foram confirmados em
Android e iOS por HTTPS. O alinhamento exigiu separar o drawing buffer da caixa
CSS do canvas: o XR8 mantinha a resolução interna maior que a viewport e também
escrevia esse tamanho como estilo inline. A caixa visual passou a ser forçada
para `100% × 100%`, preservando a resolução interna e alinhando NDC `(0, 0)` ao
centro da interface.

Modelos, versões dos sistemas/navegadores e contagem das execuções ainda devem
ser adicionados à matriz estruturada de validação.

## Limitações

- apenas o plano horizontal `Y = 0`;
- nenhuma parede, mesa ou plano independente;
- nenhuma persistência ou anchor entre sessões;
- escala `responsive`, sem garantia de metros reais;
- recenter remove o placement atual; rotação, escala por gesto, GLB e múltiplos objetos permanecem fora desta fase;
- o plano invisível é uma superfície virtual para raycasting, não plane detection.
