# WebAR World Tracking POC

Fundação técnica mínima para validar World Tracking em navegador móvel com Vite, TypeScript, Three.js e o 8th Wall Engine Binary.

O projeto renderiza um cubo em uma coordenada fixa do mundo para verificar o pipeline de câmera, tracking e Three.js. Ele ainda não implementa placement, hit test, GLB ou React.

## Status

- bootstrap Vite + TypeScript: implementado;
- Engine Binary e chunk SLAM: configurados;
- pipeline oficial Three.js + World Tracking: implementado;
- typecheck e build local: aprovados em 7 de agosto de 2026;
- teste em iPhone/Safari: pendente;
- teste em Android/Chrome: pendente;
- HTTPS/túnel móvel: não configurado nesta etapa.

Não considere o POC validado em WebAR até testá-lo em dispositivos móveis reais.

## Pré-requisitos

- Node.js 20.19 ou superior;
- npm;
- um navegador moderno para validar a página e o build;
- iPhone com Safari ou Android com navegador suportado para validar World Tracking;
- HTTPS para acesso móvel à câmera.

A documentação consultada em 7 de agosto de 2026 informa Safari no iOS 16.4 ou superior. No Android, Chrome, Firefox, Samsung Internet e Microsoft Edge estão entre os navegadores conhecidos por fornecer os recursos necessários. Confirme novamente os [requisitos oficiais de navegador](https://8thwall.org/docs/troubleshooting/browser-requirements) antes de definir uma matriz de suporte de produção.

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

O script `predev` copia automaticamente os artefatos do Engine para:

```text
public/external/xr/
```

Essa pasta é gerada e não deve ser versionada.

## Validação local

```bash
npm run typecheck
npm run build
npm run preview
```

No desktop, valide somente:

- carregamento da página;
- layout e mensagens de estado;
- typecheck e build;
- presença dos artefatos do Engine em `dist/external/xr`;
- ausência de imports e paths quebrados.

O projeto restringe `XR8.run()` a dispositivos móveis. Não altere para `allowedDevices: ANY` apenas para fazer o World Tracking aparentar funcionamento no desktop.

## Como o 8th Wall Engine é carregado

O projeto fixa `@8thwall/engine-binary` em `1.0.0`.

1. `scripts/copy-8thwall-engine.mjs` copia o conteúdo de `node_modules/@8thwall/engine-binary/dist` para `public/external/xr`.
2. O Vite copia essa pasta pública para `dist/external/xr` durante o build.
3. `index.html` carrega `external/xr/xr.js` por um `<script async>`.
4. `src/ar/engine/init8thWall.ts` aguarda o objeto `XR8` por meio de `XR8Promise`.
5. A aplicação chama `await XR8.loadChunk('slam')` antes de configurar e iniciar o pipeline.

O pacote npm fornece JavaScript, mas não declarações TypeScript. Por isso, `src/ar/engine/engineTypes.ts` contém somente os tipos das APIs efetivamente utilizadas e `src/types/8thwall-engine-binary.d.ts` tipa apenas `XR8Promise`.

`XR8.Threejs` usa o namespace global `window.THREE`. A inicialização expõe a mesma instância importada pelo Vite antes de criar o pipeline, evitando duas cópias do Three.js.

## Ordem de inicialização

```text
usuário toca em “Iniciar AR”
    ↓
pré-requisitos básicos do navegador
    ↓
XR8Promise
    ↓
XR8.loadChunk('slam')
    ↓
XR8.XrController.configure()
    ↓
pipeline modules
    ↓
XR8.run() com câmera BACK
    ↓
stream da câmera
    ↓
tracking LIMITED ou NORMAL
```

O pipeline é registrado nesta ordem:

1. `XR8.GlTextureRenderer.pipelineModule()`;
2. `XR8.Threejs.pipelineModule()`;
3. `XR8.XrController.pipelineModule()`;
4. módulo de lifecycle da aplicação.

O módulo da aplicação obtém a cena por `XR8.Threejs.xrScene()`, adiciona o cubo e chama `XR8.XrController.updateCameraProjectionMatrix()` para sincronizar a origem da câmera com o controller.

## Estados e erros

Os estados de alto nível ficam em `src/ar/tracking/trackingState.ts`:

```text
idle
loading-engine
loading-slam
requesting-camera
tracking-initializing
tracking-ready
tracking-limited
error
```

A UI só recebe transições significativas. Os callbacks por frame não provocam atualizações quando o estado permanece igual.

Erros conhecidos são normalizados nos códigos:

- `ENGINE_LOAD_ERROR`;
- `SLAM_LOAD_ERROR`;
- `CAMERA_PERMISSION_DENIED`;
- `CAMERA_UNAVAILABLE`;
- `UNSUPPORTED_BROWSER`;
- `UNSUPPORTED_DEVICE`;
- `TRACKING_INITIALIZATION_ERROR`;
- `UNKNOWN_AR_ERROR`.

## Estrutura

```text
src/
├── main.ts
├── ar/
│   ├── engine/
│   │   ├── arError.ts
│   │   ├── engineTypes.ts
│   │   ├── init8thWall.ts
│   │   └── pipeline.ts
│   ├── three/
│   │   └── scene.ts
│   └── tracking/
│       └── trackingState.ts
├── types/
│   ├── 8thwall-engine-binary.d.ts
│   └── window.d.ts
├── ui/
│   └── status.ts
└── styles/
    └── global.css
```

## Teste móvel

O fluxo esperado é:

```text
npm run dev
    ↓
túnel HTTPS
    ↓
URL pública HTTPS
    ↓
iPhone/Safari ou Android/Chrome
```

Nenhum túnel foi adicionado como dependência. Use ngrok ou outra solução HTTPS apropriada quando houver um dispositivo disponível.

Teste pelo menos:

- câmera traseira e permissão;
- carregamento do SLAM;
- chegada do tracking ao estado `NORMAL`;
- estabilidade do cubo com movimento lento;
- recuperação após `LIMITED`;
- piso texturizado e piso com pouca textura;
- boa e baixa iluminação;
- orientação portrait;
- Android intermediário, quando disponível.

Registre modelo do aparelho, versão do sistema, navegador, tempo de inicialização e problemas de câmera/GPU.

## Licença do Engine Binary

O `@8thwall/engine-binary` **não** usa a licença MIT do repositório open source. Ele é distribuído sob uma licença binária de uso limitado, com restrições de uso comercial, redistribuição e atribuição.

Antes de publicar ou transformar o POC em produto, revise:

- o arquivo `node_modules/@8thwall/engine-binary/LICENSE`;
- a [documentação do Engine](https://8thwall.org/docs/engine/overview);
- o [FAQ de uso permitido](https://8thwall.org/docs/migration/faq#distributed-engine-binary-license-and-permitted-use);
- as [orientações de atribuição](https://8thwall.org/docs/open-source).

A interface mantém uma atribuição mínima visível, mas a conformidade final deve ser avaliada conforme o produto e sua distribuição.

## APIs oficiais utilizadas

| API | Finalidade | Fonte oficial |
| --- | --- | --- |
| `XR8Promise` | Aguardar `xr.js` disponibilizar `XR8` | [Engine Overview](https://8thwall.org/docs/engine/overview) |
| `XR8.loadChunk('slam')` | Carregar World Tracking antes do Engine iniciar | [Engine Overview](https://8thwall.org/docs/engine/overview) |
| `XR8.XrController.configure()` | Manter World Tracking habilitado | [XrController.configure](https://8thwall.org/docs/api/engine/xrcontroller/configure) |
| `XR8.GlTextureRenderer.pipelineModule()` | Desenhar o camera feed | [Engine Overview](https://8thwall.org/docs/engine/overview) |
| `XR8.Threejs.pipelineModule()` | Integrar Three.js ao pipeline | [XR8.Threejs](https://8thwall.org/docs/api/engine/threejs) |
| `XR8.Threejs.xrScene()` | Obter cena, câmera e renderer oficiais | [XR8.Threejs.xrScene](https://8thwall.org/docs/api/engine/threejs/xrscene) |
| `XR8.XrController.pipelineModule()` | Processar SLAM e pose da câmera | [XrController.pipelineModule](https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule) |
| `XR8.XrDevice.isDeviceBrowserCompatible()` | Rejeitar dispositivos incompatíveis antes de iniciar o pipeline | [isDeviceBrowserCompatible](https://8thwall.org/docs/api/engine/xrdevice/isdevicebrowsercompatible) |
| `XR8.XrDevice.incompatibleReasons()` | Registrar os motivos técnicos da incompatibilidade | [incompatibleReasons](https://8thwall.org/docs/api/engine/xrdevice/incompatiblereasons) |
| `XR8.XrController.updateCameraProjectionMatrix()` | Sincronizar origem e câmera | [updateCameraProjectionMatrix](https://8thwall.org/docs/api/engine/xrcontroller/updatecameraprojectionmatrix) |
| Camera pipeline resize callbacks | Sincronizar o canvas com a viewport e a orientação do celular | [CameraPipelineModule](https://8thwall.org/docs/api/engine/xr8/addcamerapipelinemodule) |
| `XR8.run()` | Abrir a câmera e iniciar o run loop | [XR8.run](https://8thwall.org/docs/api/engine/xr8/run) |
| `XR8.stop()` | Fechar câmera e interromper tracking | [XR8.stop](https://8thwall.org/docs/api/engine/xr8/stop) |
| `XR8.removeCameraPipelineModules()` | Remover módulos no cleanup | [removeCameraPipelineModules](https://8thwall.org/docs/api/engine/xr8/removecamerapipelinemodules) |

Fontes consultadas em **7 de agosto de 2026**.

## Limitações atuais

- ainda não houve teste em iPhone ou Android real;
- não há túnel HTTPS configurado;
- o bundle JavaScript inclui o namespace completo do Three.js e gera um aviso de chunk acima de 500 kB no Vite; otimizar somente depois de validar o pipeline AR;
- o cubo usa posição fixa e não representa detecção de superfície;
- não há placement, hit test, GLB ou interação;
- a diferenciação entre câmera negada e indisponível depende dos detalhes fornecidos pelo navegador/Engine;
- a licença binária precisa ser reavaliada antes de uso comercial.
