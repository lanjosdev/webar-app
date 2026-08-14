# Placement horizontal do GLB com 8th Wall e Three.js

## Objetivo

Permitir que o usuário posicione e reposicione uma única instância de
`public/models/Logo.glb` no mundo rastreado pelo 8th Wall. O modelo começa
oculto, flutua acima do plano horizontal virtual e encara a câmera no momento
de cada placement, sem se transformar em billboard por frame.

## Carregamento e preparação do modelo

O fluxo executado antes de solicitar a câmera é:

```text
Engine pronto
    → SLAM pronto
    → fetch /models/Logo.glb
    → validar cabeçalho glTF 2.0
    → GLTFLoader.parseAsync
    → validar e normalizar bounding box
    → configurar pipeline
    → XR8.run
```

O request possui timeout de 15 segundos com `AbortController`. Respostas HTTP
inválidas, arquivo malformado, cena vazia ou bounds degenerados geram
`MODEL_LOAD_ERROR`; a câmera não é aberta e o retry cria uma nova sessão limpa.
Não existe fallback para o cubo.

O asset foi inspecionado em 13/08/2026: glTF 2.0 gerado pelo Blender, 109 KiB,
um mesh com 2.122 vértices, um material, sem textura, animação, skin ou extensão
de compressão. Por isso, a integração usa somente `GLTFLoader`, sem Draco,
Meshopt, KTX2 ou `AnimationMixer`.

Após o parse, um `Group` intermediário:

- preserva os transforms, cor base, mapas e demais propriedades exportadas;
- ajusta materiais PBR compatíveis para `metalness 0,82` e `roughness 0,32`;
- calcula o `Box3` preciso da hierarquia;
- aplica escala uniforme para maior dimensão de `0,75` unidade;
- centraliza o conteúdo em X/Z;
- move a base do conteúdo para `Y = 0` local;
- mantém o `Group` de placement oculto até o primeiro toque.

No encerramento, a hierarquia é percorrida uma única vez e libera geometrias,
materiais, texturas, `ImageBitmap` e skeletons que pertençam ao asset. O cleanup
é idempotente e também cobre falhas ocorridas antes de `XR8.run()`.

## Acabamento metálico e sombra

O acabamento é aplicado diretamente aos `MeshStandardMaterial` produzidos pelo
`GLTFLoader`. A combinação de metalness alta e roughness moderada cria reflexos
visíveis sem transformar o modelo em um espelho perfeito. Além das luzes
hemisférica e direcional, a cena gera uma única vez um environment map PMREM a
partir de `RoomEnvironment`, limitado a 128 px para reduzir o pico e a retenção
de memória GPU em dispositivos móveis. Esse mapa ilumina os materiais PBR sem
substituir o vídeo da câmera usado como fundo da experiência AR e é liberado no
cleanup.

Antes da normalização, as normais das geometrias são recalculadas com um crease
de 70 graus. Faces vizinhas com transição suave compartilham iluminação, enquanto
quinas mais fechadas permanecem definidas. O processamento acontece uma vez no
carregamento e não subdivide a malha; portanto melhora as faixas de shading, mas
não altera uma silhueta que tenha poucos segmentos no arquivo de origem.

A sombra no chão é uma aproximação visual, não uma sombra física. Uma
`DataTexture` RGBA de 64 × 64 é gerada uma vez durante a preparação do asset com
falloff radial quadrático. Ela alimenta um `MeshBasicMaterial` preto com
opacidade `0,34`, aplicado a um `PlaneGeometry` de dois triângulos posicionado
aproximadamente em `Y = 0,004` no mundo.

O plano é filho do mesmo `Group` do logo, acompanha placement, reposicionamento
e yaw e é liberado junto com o asset. O custo incremental é uma textura de 16
KiB em CPU antes do upload, uma geometria mínima e um draw call. Não são usados
shadow maps, render pass adicional, pós-processamento ou cálculos por frame além
da renderização normal desse plano.

## Rotação automática

Após um placement válido, o grupo `placement-model-normalized-content` executa
uma rotação horária uniforme no eixo Y, completando uma volta em 15 segundos.
O `placementRoot` permanece ancorado e orientado pelo toque, enquanto a sombra é
irmã do grupo animado e não gira a cada frame.

A atualização é encadeada em `Scene.onBeforeRender`, dentro do loop que o XR8 já
mantém. Não existe um segundo `requestAnimationFrame` nem `AnimationMixer`. O
ângulo é calculado por delta de tempo e o delta máximo é limitado a 100 ms para
evitar saltos visíveis após um frame travado.

A rotação:

- começa somente depois do primeiro placement;
- volta ao ângulo frontal e reinicia em cada reposicionamento;
- pausa imediatamente em tracking inseguro, recenter e lifecycle pausado;
- retoma sem acumular o tempo da pausa;
- continua aparecendo normalmente em fotos e vídeos;
- permanece desabilitada enquanto `prefers-reduced-motion: reduce` estiver ativo,
  inclusive quando essa preferência muda durante a sessão.

O custo por frame é uma soma angular, uma atualização de matriz do grupo e
nenhuma alocação. Não há geometria, textura, draw call ou passe de renderização
adicional por causa da rotação.

## Técnica de placement

O controller cria:

- um `THREE.PlaneGeometry` invisível de `100 × 100`, rotacionado sobre `Y = 0`;
- um `THREE.Raycaster` com origem no centro visual da câmera;
- distância máxima de interseção de 20 unidades da cena;
- um retículo HTML/CSS em screen-space, fixado em `50% × 50%` da viewport;
- um listener `pointerup` primário para confirmar a posição atual.

O raycast roda somente quando o tracking bruto está `NORMAL`. O retículo fica
oculto quando não há interseção ou quando o tracking está `LIMITED`. Um toque
válido posiciona a base do modelo em `intersection.y + 0,15`, criando o efeito
de flutuação.

No mesmo commit, o vetor horizontal entre o logo e a câmera determina somente
o yaw do `Group`. O eixo frontal local `+Z` aponta para a câmera, enquanto pitch
e roll permanecem zerados. Essa orientação é recalculada apenas em um novo
placement; mover o aparelho não gira o logo e preserva a coerência espacial.

`Intersection.point` está em world-space. Antes de gravar `target.position`, a
posição é convertida com `target.parent.worldToLocal()`. A orientação também é
convertida da rotação mundial desejada para o espaço local do pai, sem assumir
que a hierarquia controlada pelo XR8 seja identidade.

O `pointerup` apenas registra a intenção. O ponto, a posição e a orientação são
confirmados no próximo `Scene.onBeforeRender`, usando a mesma pose e projeção que
renderizam o primeiro frame visível do logo.

## Retículo e viewport

O retículo visual não é um objeto 3D. Dois diâmetros do anel horizontal são
projetados pela câmera a cada frame; os eixos resultantes determinam escala,
aspect ratio e rotação da elipse em screen-space.

Antes do raycast, o centro do drawing buffer é convertido para o viewport WebGL
corrente (`gl.VIEWPORT`). Isso preserva o alinhamento quando o XR8 usa cover crop
ou altera diretamente o viewport. A caixa CSS do canvas permanece em `100% ×
100%`, enquanto os atributos internos conservam a resolução do renderer.

## Fontes e versões

| Item | Versão/data | Uso | Fonte |
| --- | --- | --- | --- |
| 8th Wall Engine Binary | `1.0.0` | World Tracking e câmera | [Engine Overview](https://8thwall.org/docs/engine/overview) |
| XR8 Three.js | Consultado em 13/08/2026 | Cena e câmera integradas | [XR8.Threejs.xrScene](https://8thwall.org/docs/api/engine/threejs/xrscene) |
| Ground level | Consultado em 10/08/2026 | Confirmar chão em `Y = 0` | [World Effects](https://8thwall.org/docs/studio/guides/xr/world) |
| World Tracking | Consultado em 10/08/2026 | Plano horizontal dinâmico | [World Tracking Issues](https://8thwall.org/docs/troubleshooting/world-tracking-issues) |
| Three.js | `0.185.1` | Parse do GLB | [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) |
| Three.js | `0.185.1` | Acabamento metálico PBR | [MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html) |
| Three.js | `0.185.1` | Máscara procedural da sombra | [DataTexture](https://threejs.org/docs/pages/DataTexture.html) |
| Three.js | `0.185.1` | Rotação local no eixo Y | [Object3D](https://threejs.org/docs/pages/Object3D.html) |
| Three.js | `0.185.1` | Liberação de recursos WebGL | [How to dispose of objects](https://threejs.org/manual/en/how-to-dispose-of-objects.html) |
| Three.js | `0.185.1` | Raycast e viewport | [Raycaster](https://threejs.org/docs/pages/Raycaster.html), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) |

## Fluxo de estado

```text
loading-model
    → asset validado, normalizado e ainda oculto

tracking INITIALIZING/LIMITED
    → placement desabilitado
    → retículo oculto

tracking NORMAL + interseção central
    → retículo visível
    → toque posiciona ou reposiciona a mesma instância
    → placement = placed

tracking LIMITED após placement
    → logo preservado
    → retículo oculto
    → novos toques ignorados
```

Recenter remove o placement atual. Pausa e retomada preservam a instância, mas
bloqueiam novos placements até o tracking recuperar `NORMAL` de forma estável.

## Roteiro de validação móvel

Executar ao menos três vezes em Android/Chrome e iPhone/Safari por HTTPS:

1. Confirmar que “Carregando o modelo 3D…” aparece antes da câmera.
2. Confirmar que o logo permanece oculto antes do primeiro toque.
3. Mirar acima do horizonte e confirmar que o retículo não aparece.
4. Mirar no chão, tocar e verificar maior dimensão consistente, base flutuando e logo em pé.
5. Confirmar highlights metálicos suaves, sem regiões pretas ou cintilação durante o movimento.
6. Confirmar sombra discreta sob o logo, sem retângulo visível ao redor do gradiente.
7. Cronometrar aproximadamente 15 segundos por volta, sem variação perceptível por FPS.
8. Mover o aparelho e confirmar que o anchor não acompanha a câmera, embora o logo gire internamente.
9. Reposicionar e confirmar que a face volta para a câmera antes de reiniciar a rotação.
10. Forçar `LIMITED`; o retículo deve sumir e a rotação deve pausar sem salto ao retomar.
11. Recenter deve remover o logo e exigir novo placement.
12. Validar pausa/retomada e `prefers-reduced-motion: reduce`.
13. Validar foto, vídeo e compartilhamento com o GLB girando.
14. Simular asset indisponível e confirmar `MODEL_LOAD_ERROR` seguido de retry limpo.
15. Registrar startup, FPS, estabilidade, memória e condições do ambiente.

## Limitações

- apenas o plano horizontal virtual `Y = 0`;
- nenhuma parede, mesa, plane detection, anchor persistente ou WebXR Hit Test;
- escala XR8 `responsive`, sem garantia de metros físicos;
- sem clips de animação do GLB, gestos de rotação/escala, environment map ou sombras físicas;
- a sombra elíptica não reage à direção da luz nem à geometria do ambiente real;
- somente uma instância do `Logo.glb` por sessão;
- a validação móvel específica do GLB deve ser registrada após o deploy.
