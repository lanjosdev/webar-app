# WebAR World Tracking POC

Fundação técnica mínima para validar World Tracking em navegador móvel com Vite, TypeScript, Three.js e o 8th Wall Engine Binary.

O projeto usa um retículo central para posicionar e reposicionar um cubo no plano
horizontal `Y = 0`, validando câmera, tracking, Three.js e interação básica. Ele
ainda não implementa múltiplos planos, anchors, escala física, GLB ou React.

## Status

- bootstrap Vite + TypeScript: implementado;
- Engine Binary e chunk SLAM: configurados;
- pipeline oficial Three.js + World Tracking: implementado;
- typecheck e build local: aprovados em 10 de agosto de 2026;
- smoke tests em Android/Chrome e iPhone/Safari: câmera, canvas fullscreen, tracking e cubo confirmados;
- placement central e reposicionamento: confirmados em Android e iOS em 10 de agosto de 2026;
- recuperação estabilizada e recenter manual: confirmados em Android e iOS em 10 de agosto de 2026;
- HTTPS/túnel móvel: fluxo manual com ngrok documentado, sem dependência no projeto.

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

1. módulo de canvas fullscreen da aplicação;
2. `XR8.GlTextureRenderer.pipelineModule()`;
3. `XR8.Threejs.pipelineModule()`;
4. `XR8.XrController.pipelineModule()`;
5. módulo de lifecycle da aplicação.

O módulo da aplicação obtém a cena por `XR8.Threejs.xrScene()`, cria o controller
de placement e chama `XR8.XrController.updateCameraProjectionMatrix()` para
sincronizar a origem da câmera com o controller.

## Estados e erros

Os estados de alto nível ficam em `src/ar/tracking/trackingState.ts`:

```text
idle
loading-engine
loading-slam
requesting-motion
requesting-camera
tracking-initializing
tracking-ready
tracking-limited
tracking-recovering
error
```

A UI só recebe transições significativas de estado. O placement mantém um estado
ortogonal `not-placed | placed`, permitindo preservar o objeto quando o tracking
fica `LIMITED`. O raycast e a transformação visual do retículo são atualizados no
loop Three.js, sem propagar pose ou transforms pelo estado da aplicação.

Erros conhecidos são normalizados nos códigos:

- `ENGINE_LOAD_ERROR`;
- `SLAM_LOAD_ERROR`;
- `MOTION_PERMISSION_DENIED`;
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
│   ├── tracking/
│   │   ├── trackingRecovery.ts
│   │   └── trackingState.ts
│   └── world/
│       └── placement.ts
├── types/
│   ├── 8thwall-engine-binary.d.ts
│   └── window.d.ts
├── ui/
│   └── status.ts
└── styles/
    └── global.css
```

## Teste móvel

Use duas janelas do PowerShell. Na primeira, inicie o Vite na porta fixa `5173` e
autorize apenas o domínio ngrok reservado para este projeto:

```powershell
cd "D:\Documentos\PROJETOS ESTUDOS\webar-app"
$env:__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="roving-helping-reporter.ngrok-free.dev"
npm run dev -- --port 5173 --strictPort
```

Na segunda janela, inicie o túnel HTTPS:

```powershell
ngrok http 5173 --url=https://roving-helping-reporter.ngrok-free.dev
```

O fluxo resultante é:

```text
Vite em http://localhost:5173
    ↓
ngrok
    ↓
https://roving-helping-reporter.ngrok-free.dev
    ↓
iPhone/Safari ou Android/Chrome
```

Se o domínio reservado mudar, atualize o hostname nos dois comandos. O ngrok
permanece uma ferramenta externa e não foi adicionado às dependências do projeto.

O modo fullscreen preenche toda a viewport com comportamento equivalente a
`cover`. Como a proporção do vídeo difere da tela em retrato, as laterais da
câmera são recortadas e podem transmitir uma leve sensação de zoom. Isso é
esperado; preservar toda a imagem exigiria faixas vazias.

O XR8 pode escrever as dimensões lógicas do drawing buffer como estilos inline
no canvas. A folha global força apenas a caixa CSS para `100% × 100%` da viewport
com `!important`, preservando os atributos internos do buffer. Isso evita que um
canvas maior seja recortado e desalinhe o centro 3D do centro da interface.

Teste pelo menos:

- câmera traseira e permissão;
- carregamento do SLAM;
- chegada do tracking ao estado `NORMAL`;
- estabilidade do cubo com movimento lento;
- recuperação após `LIMITED`;
- confirmação, cancelamento e conclusão do recenter;
- piso texturizado e piso com pouca textura;
- boa e baixa iluminação;
- orientação portrait;
- Android intermediário, quando disponível.

Siga o procedimento e registre os resultados em
[`docs/mobile-world-tracking-validation.md`](docs/mobile-world-tracking-validation.md).

## Placement horizontal

Quando o tracking chega a `NORMAL`, um `THREE.Raycaster` é projetado a partir do
centro da câmera contra um `PlaneGeometry` invisível em `Y = 0`. Um retículo de
UI em screen-space, fixado em `50% × 50%` da viewport, indica a interseção válida.
Sua forma e rotação reproduzem a projeção do plano horizontal: fica mais circular
ao mirar para baixo e mais elíptico perto do horizonte, sem perder a centralização.
O centro visual é convertido do drawing buffer para o viewport WebGL corrente
antes do raycast, mantendo o ponto 3D alinhado ao overlay mesmo com recorte
fullscreen. O viewport é consultado no contexto WebGL porque o XR8 também altera
esse estado diretamente. O primeiro toque mostra o cubo nessa posição e os toques
seguintes reposicionam a mesma instância. O `pointerup` apenas solicita a ação;
a posição é confirmada no próximo `Scene.onBeforeRender`, usando a mesma pose de
câmera que renderiza o primeiro frame visível do cubo. Como a interseção do
`Raycaster` está em world-space e o cubo pertence a um `Group`, a posição também
é convertida explicitamente para o espaço local do pai antes de atualizar sua
matriz.

O retículo desaparece quando o centro da câmera não intersecta o plano ou quando
o tracking está `LIMITED`. O cubo colocado permanece visível durante a perda
temporária de tracking.

Essa técnica representa somente o chão horizontal mantido pelo World Tracking;
ela não é WebXR Hit Test, detecção de múltiplos planos ou criação de anchors.
Detalhes, fontes e roteiro de testes estão em
[`docs/8thwall-ground-placement.md`](docs/8thwall-ground-placement.md).

## Recuperação e recenter

O status bruto do Engine controla a segurança da interação: qualquer frame
`LIMITED` ou sem resultado bloqueia o placement imediatamente. A UI usa uma
janela de 750 ms antes de mostrar `tracking-limited`, evitando oscilações
visuais, e exige 500 ms contínuos em `NORMAL` para restaurar o retículo.

No iOS, a aplicação solicita `DeviceMotionEvent` e
`DeviceOrientationEvent` a partir de uma confirmação própria em português,
antes de executar `XR8.run()`. O pedido ocorre diretamente no toque em
**Continuar**, como exigido pelo Safari. Isso evita o painel auxiliar em inglês
do Engine; o alerta nativo final continua sob controle do iOS e segue o idioma
configurado no aparelho. Em navegadores que não expõem `requestPermission()`,
essa etapa é ignorada.

O botão circular com ícone de recenter fica disponível depois do primeiro tracking
estável. Quando existe um objeto, a aplicação abre uma confirmação em um bottom
sheet porque
`XR8.XrController.recenter()` reinicia o tracking e redefine o referencial. Ao
confirmar, o cubo é removido e um novo placement será necessário. Se o tracking
não se recuperar em 8 segundos, a aplicação volta ao estado limitado e libera
outra tentativa.

Esse fluxo melhora previsibilidade e recuperação, mas não aumenta a precisão
interna do SLAM. Consulte a técnica e o roteiro em
[`docs/8thwall-tracking-recovery.md`](docs/8thwall-tracking-recovery.md).

## Licença do Engine Binary

O `@8thwall/engine-binary` **não** usa a licença MIT do repositório open source. Ele é distribuído sob uma licença binária de uso limitado, com restrições de uso comercial, redistribuição e atribuição.

Antes de publicar ou transformar o POC em produto, revise:

- o arquivo `node_modules/@8thwall/engine-binary/LICENSE`;
- a [documentação do Engine](https://8thwall.org/docs/engine/overview);
- o [FAQ de uso permitido](https://8thwall.org/docs/migration/faq#distributed-engine-binary-license-and-permitted-use);
- as [orientações de atribuição](https://8thwall.org/docs/open-source).

Para esta aplicação web, os avisos legais são preservados nos arquivos originais
`external/xr/xr.js` e `external/xr/LICENSE`, que permanecem públicos no deploy e
acessíveis pelas ferramentas do navegador. O script
`scripts/verify-8thwall-license.mjs` é executado automaticamente após
`npm run build` e interrompe o build se esses arquivos ou seus avisos essenciais
de copyright, licença e ausência de garantias não estiverem presentes.

O Engine deve continuar sendo distribuído em sua forma original. A conformidade
final ainda deve ser avaliada conforme o produto, o modelo comercial e a forma
de distribuição.

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
| `XR8.XrController.recenter()` | Reiniciar tracking no referencial configurado | [recenter](https://8thwall.org/docs/api/engine/xrcontroller/recenter) |
| Camera pipeline resize callbacks | Sincronizar o canvas com a viewport e a orientação do celular | [CameraPipelineModule](https://8thwall.org/docs/api/engine/xr8/addcamerapipelinemodule) |
| `XR8.run()` | Abrir a câmera e iniciar o run loop | [XR8.run](https://8thwall.org/docs/api/engine/xr8/run) |
| `XR8.stop()` | Fechar câmera e interromper tracking | [XR8.stop](https://8thwall.org/docs/api/engine/xr8/stop) |
| `XR8.removeCameraPipelineModules()` | Remover módulos no cleanup | [removeCameraPipelineModules](https://8thwall.org/docs/api/engine/xr8/removecamerapipelinemodules) |

Fontes consultadas em **10 de agosto de 2026**.

## Limitações atuais

- modelos, versões e contagem das execuções de placement ainda precisam ser registrados na matriz estruturada;
- modelos dos aparelhos, versões e tempos dos smoke tests iniciais ainda precisam ser registrados;
- o túnel HTTPS depende de um processo ngrok externo executado manualmente;
- o bundle JavaScript inclui o namespace completo do Three.js e gera um aviso de chunk acima de 500 kB no Vite; otimizar somente depois de validar o pipeline AR;
- o placement funciona somente sobre o plano horizontal virtual `Y = 0`;
- o modo fullscreen recorta as laterais da câmera para preencher a viewport;
- não há múltiplos planos, anchors, WebXR Hit Test, escala absoluta, GLB ou gestos de manipulação;
- a diferenciação entre câmera negada e indisponível depende dos detalhes fornecidos pelo navegador/Engine;
- a licença binária precisa ser reavaliada antes de uso comercial.
