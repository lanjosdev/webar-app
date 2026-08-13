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

- preserva os transforms e o material exportados;
- calcula o `Box3` preciso da hierarquia;
- aplica escala uniforme para maior dimensão de `0,75` unidade;
- centraliza o conteúdo em X/Z;
- move a base do conteúdo para `Y = 0` local;
- mantém o `Group` de placement oculto até o primeiro toque.

No encerramento, a hierarquia é percorrida uma única vez e libera geometrias,
materiais, texturas, `ImageBitmap` e skeletons que pertençam ao asset. O cleanup
é idempotente e também cobre falhas ocorridas antes de `XR8.run()`.

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
5. Verificar que a face está legível e voltada para a câmera no primeiro frame.
6. Mover o aparelho e confirmar que o logo não acompanha a câmera por frame.
7. Reposicionar de outro ângulo e confirmar novo yaw sem duplicar a instância.
8. Forçar `LIMITED`; o retículo deve sumir e o logo deve permanecer imóvel.
9. Recenter deve remover o logo e exigir novo placement.
10. Validar pausa/retomada, foto, vídeo e compartilhamento com o GLB visível.
11. Simular asset indisponível e confirmar `MODEL_LOAD_ERROR` seguido de retry limpo.
12. Registrar startup, FPS, estabilidade, memória e condições do ambiente.

## Limitações

- apenas o plano horizontal virtual `Y = 0`;
- nenhuma parede, mesa, plane detection, anchor persistente ou WebXR Hit Test;
- escala XR8 `responsive`, sem garantia de metros físicos;
- sem animações, gestos de rotação/escala, sombras ou environment map;
- somente uma instância do `Logo.glb` por sessão;
- a validação móvel específica do GLB deve ser registrada após o deploy.
