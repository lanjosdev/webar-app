# Showroom 3D e fronteira com a experiência WebAR

## Objetivo

A página inicial oferece uma prévia 3D com mouse ou touch antes de solicitar
câmera e sensores. Showroom e WebAR vivem no mesmo documento, mas nunca mantêm
renderers ou ciclos de renderização ativos ao mesmo tempo.

```text
showroom
  → compatibilidade AR confirmada sem câmera
  → permissão de movimento no iOS, quando necessária
  → runtime AR importado, ainda sem câmera
  → handoff de 180 ms
  → dispose completo da prévia
  → XR8.run() e câmera traseira
```

## Responsabilidades

- `app/experienceController.ts`: estado `showroom | handoff | ar`, permissões,
  compatibilidade, visibilidade da página e ordenação do descarte.
- `showroom/`: renderer, cena de galeria, `OrbitControls`, resize, RAF sob
  demanda e cleanup da prévia.
- `three/modelAsset.ts`: fetch, validação GLB, parse, normais, acabamento PBR,
  normalização e descarte neutros, sem dependência de XR8 ou placement.
- `ar/arExperience.ts`: tracking state, status, captura e lifecycle da sessão
  AR.
- `ar/three/model.ts`: adapta uma nova instância neutra para placement,
  sombra e autorrotação no mundo rastreado.

As duas experiências usam instâncias independentes do GLB. A segunda requisição
usa `cache: "default"`, mas cada parse possui seus próprios objetos, materiais,
geometrias e ownership. Nenhum `Object3D` atravessa a fronteira.

## Performance e lifecycle

- pixel ratio do showroom limitado a `1.5`;
- PMREM criado uma vez em `128 px`;
- sem shadow maps ou pós-processamento;
- autorrotação limitada aos primeiros 12 segundos ou à primeira interação;
- RAF encerrado quando `OrbitControls.update()` deixa de alterar a câmera;
- `ResizeObserver` atualiza o drawing buffer somente quando necessário;
- `visibilitychange` pausa showroom ou XR8 conforme o modo ativo;
- no handoff, controles, observadores, asset, PMREM, materiais, renderer e
  contexto WebGL são liberados antes de iniciar o XR8.

## Engine e fontes

O Engine continua sendo carregado pelo `<script async>` oficial e acessado por
`XR8Promise`. A home não injeta scripts dinamicamente e não chama `XR8.run()`
durante a prévia. O chunk `slam` continua sendo carregado somente na entrada da
sessão AR.

| API | Uso | Fonte | Consultado |
| --- | --- | --- | --- |
| `XR8Promise` | Compatibilidade e espera pelo Engine | [Engine Overview](https://8thwall.org/docs/engine/overview) | 14/08/2026 |
| `XR8.XrDevice.isDeviceBrowserCompatible()` | Restringir World Tracking a mobile compatível | [XrDevice](https://8thwall.org/docs/api/engine/xrdevice) | 14/08/2026 |
| `XR8.run()` | Abrir a câmera somente depois do handoff | [XR8.run](https://8thwall.org/docs/api/engine/xr8/run) | 14/08/2026 |
| `OrbitControls` | Rotação, dolly, damping e reset | [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) | 14/08/2026 |
| `dispose()` | Liberação explícita de recursos GPU | [Three.js cleanup](https://threejs.org/manual/en/how-to-dispose-of-objects.html) | 14/08/2026 |

## Limites desta entrega

Não existem configuração de cor/material, armazenamento, múltiplos modelos ou
sincronização de aparência. A extração do asset neutro apenas evita duplicar o
pipeline de preparação e deixa as cenas independentes para uma evolução futura.
