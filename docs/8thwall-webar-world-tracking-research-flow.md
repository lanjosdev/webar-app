# Research Flow — 8th Wall WebAR World Tracking / Surface AR

> **Objetivo:** servir como guia de pesquisa para um agente de programação que precise implementar, depurar e manter uma aplicação WebAR com **8th Wall World Tracking / Surface AR**, com foco em navegador móvel e integração com **Three.js + TypeScript/Vite**.
>
> **Data de referência:** 2026-08-07.
>
> **Regra principal:** antes de implementar uma API do 8th Wall, consulte a documentação oficial atual e os exemplos oficiais. Não assuma que tutoriais antigos sobre a plataforma hospedada continuam válidos.

---

## 0. Contexto atual obrigatório

O 8th Wall passou por uma mudança importante em 2026:

- A plataforma hospedada foi aposentada em **28/02/2026**.
- Experiências antigas publicadas continuam funcionando até **28/02/2027**.
- O desenvolvimento atual é orientado para execução local / self-hosted.
- O **XR Engine** é distribuído como um binário e inclui o mecanismo necessário para **World Tracking / SLAM**.
- O restante do ecossistema open source inclui, entre outros, exemplos, Image Targets, Face Effects e Sky Effects.
- Para World Tracking, não assumir que o framework MIT isoladamente contém o SLAM: verificar sempre a documentação atual do **XR Engine Binary** e sua licença.

Fontes oficiais:
- https://8thwall.org/
- https://8thwall.org/docs/getting-started
- https://8thwall.org/docs/engine
- https://8thwall.org/docs/open-source

---

# 1. Fluxo geral de pesquisa

O agente deve seguir esta ordem:

```text
Requisitos
   ↓
Documentação oficial atual
   ↓
Engine / World Tracking
   ↓
Exemplo oficial mais próximo
   ↓
Integração Three.js
   ↓
Ciclo de câmera + tracking
   ↓
Posicionamento / Surface AR
   ↓
UX de tracking
   ↓
iOS / dispositivos reais
   ↓
Performance
   ↓
Build / deploy
   ↓
Testes
   ↓
Documentação do projeto
```

**Nunca começar pela implementação copiando um tutorial aleatório.**

---

# 2. Fontes oficiais prioritárias

## 2.1 Documentação principal

### Getting Started

https://8thwall.org/docs/getting-started

Consultar para:
- modelo atual de desenvolvimento;
- instalação;
- execução local;
- organização dos projetos;
- Engine;
- Studio;
- fluxo atual pós-plataforma hospedada.

---

## 2.2 8th Wall Engine

https://8thwall.org/docs/engine

É a referência principal para compreender o Engine.

Confirmar nesta fonte:
- papel do SLAM;
- World Tracking;
- Image Targets;
- integrações com Three.js;
- A-Frame;
- PlayCanvas;
- Babylon.js.

---

## 2.3 Engine Overview

https://8thwall.org/docs/engine/overview

Consultar antes de implementar uma integração customizada.

Pontos importantes:
- carregamento via `<script>`;
- pacote `@8thwall/engine-binary`;
- `XR8Promise`;
- preload do chunk `slam`;
- integração com Three.js;
- `XR8.run()`;
- pipeline modules;
- desenvolvimento local;
- teste em dispositivos móveis via HTTPS.

Para World Tracking + Image Targets, verificar o carregamento do chunk:

```html
<script
  src=".../xr.js"
  async
  data-preload-chunks="slam"
></script>
```

ou equivalente usando `XR8.loadChunk('slam')`.

---

# 3. World Tracking / Surface AR

## 3.1 World Effects

https://8thwall.org/docs/studio/guides/xr/world

Usar para entender o conceito de World Effects.

Verificar:
- câmera configurada para World;
- coordenadas;
- relação entre câmera e mundo;
- ground level;
- uso de objetos 3D;
- sombras;
- interação com ambiente.

Ponto importante da documentação atual:

```text
Y = 0
```

representa o nível do chão relativo ao camera feed no contexto de World Effects.

Não assumir que isso significa detecção arbitrária de múltiplos planos como ARKit/ARCore.

---

## 3.2 World Tracking não é simplesmente WebXR Plane Detection

O agente deve manter esta distinção:

```text
WebXR Hit Test / Plane Detection
        ≠
8th Wall World Tracking / SLAM
```

O 8th Wall possui seu próprio mecanismo de tracking.

Para requisitos do tipo:

- detectar chão;
- posicionar objeto;
- manter objeto ancorado;
- acompanhar movimento da câmera;

investigar primeiro as capacidades do 8th Wall World Tracking.

Para requisitos como:

- múltiplos planos independentes;
- parede + mesa + chão simultaneamente;
- scene understanding avançado;
- semantic labels;

não assumir suporte. Consultar documentação atual e validar experimentalmente.

---

# 4. Integração recomendada: Three.js

## 4.1 Engine + Three.js

https://8thwall.org/docs/engine/overview

Para uma aplicação moderna em TypeScript/Vite, priorizar a integração direta com Three.js se o projeto já usa Three.js.

Arquitetura conceitual:

```text
React / TypeScript
        │
        ├── UI / UX
        │
        └── AR Application
               │
               ├── 8th Wall Engine
               │      └── SLAM / World Tracking
               │
               └── Three.js
                      ├── Scene
                      ├── Camera
                      ├── Renderer
                      ├── Lights
                      └── 3D Assets
```

---

## 4.2 XR8.Threejs

https://8thwall.org/docs/api/engine/threejs

Consultar para:
- `pipelineModule`;
- renderer;
- XR scene;
- camera;
- integração com o ciclo de vida do Three.js.

---

# 5. Pipeline de câmera

## 5.1 XR8.run

https://8thwall.org/docs/api/engine/xr8/run

Estudar:
- abertura da câmera;
- canvas;
- WebGL2/WebGL1;
- câmera traseira;
- dispositivos permitidos;
- run loop;
- configurações da sessão.

Regra importante:

**World Tracking / SLAM utiliza a câmera traseira.**

Se a aplicação usar câmera frontal, verificar a necessidade de desabilitar World Tracking.

---

## 5.2 Pipeline Modules

https://8thwall.org/docs/api/engine/camera-pipeline-module

Pesquisar e entender:

```text
Camera Feed
    ↓
Pipeline Modules
    ├── GlTextureRenderer
    ├── Threejs
    ├── XrController
    └── Custom Modules
```

Antes de escrever um pipeline customizado, procurar primeiro um exemplo oficial que já implemente o fluxo desejado.

---

# 6. XrController

## 6.1 Configuração

https://8thwall.org/docs/api/engine/xrcontroller/configure

Estudar:
- `disableWorldTracking`;
- `enableLighting`;
- `enableWorldPoints`;
- `scale`;
- configurações de Image Targets.

Para Surface/World AR, verificar especialmente:

```js
XR8.XrController.configure({
  disableWorldTracking: false
})
```

Não alterar configurações depois de `XR8.run()` sem verificar se a API atual permite a mudança.

---

# 7. Eventos e estado do tracking

## World Effects Events

https://8thwall.org/docs/api/studio/events/xr/world

Estudar o evento:

```text
REALITY_TRACKING_STATUS
```

Estados documentados incluem:
- `LIMITED`;
- `NORMAL`.

Razões incluem:
- `INITIALIZING`;
- `UNDEFINED`.

Usar esse estado para UX, por exemplo:

```text
Inicializando
      ↓
Procurando superfície
      ↓
Tracking normal
      ↓
Permitir posicionamento
```

Não confiar apenas em um timeout para determinar que o tracking está pronto.

---

# 8. Primeiro protótipo obrigatório

Antes de criar uma aplicação completa, implementar este POC:

```text
1. Abrir página HTTPS no celular
2. Solicitar câmera
3. Inicializar 8th Wall Engine
4. Ativar World Tracking
5. Mostrar camera feed
6. Inicializar Three.js
7. Detectar/usar o ground/world tracking disponível
8. Posicionar um cubo simples
9. Permitir movimentação da câmera
10. Verificar estabilidade do cubo
11. Mostrar estado do tracking
12. Reiniciar a experiência
```

O primeiro objetivo NÃO deve ser:
- GLTF complexo;
- animação;
- física;
- multiplayer;
- React state complexo;
- analytics;
- CMS.

Primeiro validar o tracking.

---

# 9. Segundo POC: posicionamento

Depois do tracking básico:

```text
Tracking
   ↓
superfície / ground
   ↓
gesto do usuário
   ↓
posição 3D
   ↓
Object3D.position
   ↓
objeto ancorado
```

Investigar nas APIs atuais qual mecanismo oficial do Engine deve ser usado para o tipo exato de posicionamento desejado.

Não inventar APIs de `planeDetection`, `hitTest` ou `anchors` com nomes herdados de WebXR.

Pesquisar primeiro:
- `XrController`;
- World Tracking;
- World Effects;
- exemplos oficiais;
- documentação de hit/placement correspondente à versão atual.

---

# 10. Terceiro POC: asset real

Somente depois do cubo:

```text
GLB / GLTF
   ↓
GLTFLoader
   ↓
Scene
   ↓
Scale
   ↓
Position
   ↓
Lighting
   ↓
Shadow
```

Validar:
- tamanho real;
- orientação;
- escala;
- origem do modelo;
- materiais;
- iluminação;
- sombras;
- animações;
- memória.

---

# 11. iOS: requisito de primeira classe

Como o projeto precisa funcionar no Safari iOS:

## Testar em dispositivo real

Não considerar:

```text
Chrome desktop
```

ou

```text
Safari desktop
```

como validação suficiente.

O teste mínimo deve incluir:
- iPhone real;
- Safari;
- câmera traseira;
- HTTPS;
- orientação portrait;
- orientação landscape, se suportada;
- diferentes condições de iluminação.

Consultar sempre:
- Browser Requirements;
- Troubleshooting;
- Release Notes.

---

# 12. HTTPS obrigatório para desenvolvimento móvel

O fluxo oficial de desenvolvimento móvel utiliza HTTPS.

Uma abordagem de teste:

```text
localhost
   ↓
dev server
   ↓
ngrok / outro túnel HTTPS
   ↓
Safari iPhone
   ↓
câmera
```

Consultar a seção de testing da documentação do Engine:

https://8thwall.org/docs/engine/overview

Não assumir que `http://192.168.x.x` funcionará para todos os recursos necessários.

---

# 13. Performance

Investigar sistematicamente:

## Engine
- preload de `slam`;
- tempo de inicialização;
- memória;
- tamanho dos assets;
- WebAssembly;
- WebGL.

## Three.js
- número de polígonos;
- draw calls;
- texturas;
- sombras;
- pós-processamento;
- animações.

## Mobile
- FPS;
- temperatura;
- consumo de bateria;
- perda de tracking;
- recovery após tracking loss.

---

# 14. UX de Surface AR

A aplicação deve ter estados explícitos:

```text
LOADING
   ↓
CAMERA_PERMISSION
   ↓
TRACKING_INITIALIZING
   ↓
SEARCHING_SURFACE
   ↓
SURFACE_READY
   ↓
OBJECT_PLACED
   ↓
TRACKING_LIMITED
   ↓
TRACKING_RECOVERING
```

Criar mensagens como:

```text
"Movimente lentamente o celular."
```

```text
"Continue apontando para uma área com detalhes."
```

```text
"Superfície encontrada."
```

```text
"Toque para posicionar."
```

Não esconder o fato de que o tracking pode ficar limitado.

---

# 15. Tracking perdido / recovery

Pesquisar especificamente:

- `REALITY_TRACKING_STATUS`;
- `LIMITED`;
- recovery do SLAM;
- comportamento quando a câmera perde feature points;
- mudança brusca de iluminação;
- superfícies sem textura;
- movimento rápido.

Criar um fallback visual:

```text
Tracking normal
      ↓
Tracking limitado
      ↓
"Movimente o celular"
      ↓
Tracking normal
```

Não destruir imediatamente a cena quando o tracking ficar limitado.

---

# 16. Condições ambientais

Testar:

### Boas condições
- piso com textura;
- iluminação uniforme;
- ambiente estático;
- movimento lento.

### Condições ruins
- piso completamente liso;
- parede branca;
- pouca iluminação;
- reflexos;
- vidro;
- movimento rápido;
- câmera muito próxima;
- ambiente com pouca textura.

Registrar os resultados.

---

# 17. Arquitetura recomendada

Para uma aplicação React/TypeScript/Vite:

```text
src/
├── ar/
│   ├── engine/
│   │   ├── init8thWall.ts
│   │   ├── pipeline.ts
│   │   └── tracking.ts
│   │
│   ├── three/
│   │   ├── scene.ts
│   │   ├── camera.ts
│   │   ├── renderer.ts
│   │   └── assets.ts
│   │
│   ├── world/
│   │   ├── placement.ts
│   │   ├── trackingState.ts
│   │   └── worldEvents.ts
│   │
│   └── types/
│
├── components/
│   ├── CameraView.tsx
│   ├── TrackingStatus.tsx
│   ├── PlacementUI.tsx
│   └── ARControls.tsx
│
├── hooks/
│   ├── useARSession.ts
│   └── useTrackingStatus.ts
│
└── App.tsx
```

Manter a camada 8th Wall desacoplada da UI React.

---

# 18. Regra de integração React

Não colocar o ciclo de tracking dentro do React render loop.

Evitar:

```text
React state
   ↓
a cada frame
   ↓
re-render
   ↓
Three.js
```

Preferir:

```text
React
  ↓
UI / lifecycle

8th Wall
  ↓
tracking loop

Three.js
  ↓
render loop
```

React deve controlar:
- UI;
- estado de alto nível;
- menus;
- mensagens;
- controles.

Three.js/8th Wall devem controlar:
- cena;
- câmera;
- objetos;
- tracking;
- renderização por frame.

---

# 19. Assets

Para GLB/GLTF:

- preferir GLB;
- comprimir geometria quando apropriado;
- comprimir texturas;
- reduzir resolução de texturas;
- evitar assets gigantes;
- carregar assets depois da inicialização crítica da câmera quando possível.

Validar no iPhone, não apenas no desktop.

---

# 20. Segurança e permissões

Verificar:
- HTTPS;
- `getUserMedia`;
- permissões de câmera;
- políticas de iframe;
- CSP;
- origem;
- hosting;
- assets cross-origin;
- MIME types.

Não presumir que uma aplicação funcionando localmente funcionará em produção sem ajustes.

---

# 21. Build e deploy

Validar:

```text
npm run build
   ↓
dist/
   ↓
static hosting
   ↓
HTTPS
   ↓
Safari iOS
```

Para o Engine Binary, confirmar a estratégia atual de distribuição dos artefatos.

A documentação oficial mostra integração via:

```text
@8thwall/engine-binary
```

ou carregamento do Engine a partir dos artefatos distribuídos.

Fonte:

https://8thwall.org/docs/engine/overview

---

# 22. O que NÃO fazer

## Não usar tutorial antigo da plataforma hospedada como fonte principal

O hosted 8th Wall foi aposentado em 2026.

## Não assumir que todo código de versões antigas continua correto

Pesquisar a versão atual da API.

## Não misturar APIs de WebXR sem necessidade

Não escrever:

```js
navigator.xr
```

só porque o objetivo é AR.

O 8th Wall possui seu próprio Engine.

## Não assumir que "Surface AR" = "plane detection completo"

Confirmar a capacidade exata.

## Não começar com um projeto complexo

Primeiro provar:

```text
camera
→ SLAM
→ world tracking
→ placement
→ stable object
```

---

# 23. Hierarquia de fontes

Ao pesquisar qualquer dúvida, usar esta prioridade:

### Nível 1 — documentação oficial

`https://8thwall.org/docs`

### Nível 2 — API oficial

`https://8thwall.org/docs/api`

### Nível 3 — exemplos oficiais

`https://github.com/8thwall`

### Nível 4 — release notes

`https://8thwall.org/docs/engine/release-notes`

### Nível 5 — troubleshooting oficial

`https://8thwall.org/docs/troubleshooting`

### Nível 6 — GitHub Issues / Discussions

Usar para problemas reais que não estejam esclarecidos na documentação.

### Nível 7 — blogs, Stack Overflow, Reddit, vídeos

Usar apenas como complemento.

Sempre validar a informação contra a documentação atual antes de implementá-la.

---

# 24. Estratégia de pesquisa do agente

Quando surgir uma dúvida:

```text
Pergunta
  ↓
A API está na documentação oficial?
  ├── Sim → usar documentação
  └── Não
       ↓
Existe exemplo oficial?
  ├── Sim → estudar exemplo
  └── Não
       ↓
Existe API Reference?
  ├── Sim → verificar assinatura/comportamento
  └── Não
       ↓
Release Notes
       ↓
Troubleshooting
       ↓
GitHub oficial
       ↓
Fontes externas
```

Para cada informação crítica, registrar:

```text
Fonte:
URL:
Data consultada:
Versão:
Conclusão:
```

---

# 25. Perguntas que o agente deve responder antes da implementação

Antes de escrever a primeira versão, responder:

- Qual versão atual do 8th Wall Engine está sendo utilizada?
- Qual é a forma atual recomendada de instalar/carregar o Engine?
- O projeto usa Studio ou Engine diretamente?
- O World Tracking está disponível no setup escolhido?
- O `slam` chunk está sendo carregado?
- Qual é a API oficial atual para World Tracking?
- Como o objeto é colocado no mundo?
- Como o tracking informa seu estado?
- Como recuperar de `LIMITED`?
- Quais navegadores/dispositivos são suportados?
- Qual é o requisito mínimo de iOS?
- Como testar câmera via HTTPS?
- Qual é a integração recomendada com Three.js?
- Como os assets 3D são carregados?
- Qual é a estratégia de build/deploy?
- O licenciamento do XR Engine Binary atende ao projeto?

---

# 26. Checklist de aceite do POC

## Inicialização

- [ ] Engine carrega
- [ ] chunk `slam` carrega
- [ ] câmera abre
- [ ] permissão funciona
- [ ] canvas ocupa a viewport

## Tracking

- [ ] SLAM inicia
- [ ] tracking chega a estado normal
- [ ] tracking funciona em iOS
- [ ] tracking sobrevive a movimentos normais
- [ ] tracking recupera após perda temporária

## Surface / placement

- [ ] superfície/chão é utilizável
- [ ] objeto pode ser colocado
- [ ] objeto permanece estável
- [ ] escala é coerente
- [ ] orientação é coerente

## UX

- [ ] loading
- [ ] permission state
- [ ] searching state
- [ ] ready state
- [ ] limited tracking state
- [ ] recovery state

## Performance

- [ ] FPS aceitável
- [ ] sem vazamento de memória evidente
- [ ] asset não excessivamente pesado
- [ ] sem travamentos durante tracking

## iOS

- [ ] Safari iPhone
- [ ] câmera traseira
- [ ] HTTPS
- [ ] portrait
- [ ] landscape, se necessário

---

# 27. Fontes oficiais essenciais

- 8th Wall: https://8thwall.org/
- Documentation: https://8thwall.org/docs
- Getting Started: https://8thwall.org/docs/getting-started
- Engine: https://8thwall.org/docs/engine
- Engine Overview: https://8thwall.org/docs/engine/overview
- World Effects: https://8thwall.org/docs/studio/guides/xr/world
- Engine API: https://8thwall.org/docs/api/engine
- XR8.Threejs: https://8thwall.org/docs/api/engine/threejs
- XR8.run: https://8thwall.org/docs/api/engine/xr8/run
- XrController.configure: https://8thwall.org/docs/api/engine/xrcontroller/configure
- World Events: https://8thwall.org/docs/api/studio/events/xr/world
- Release Notes: https://8thwall.org/docs/engine/release-notes
- Troubleshooting: https://8thwall.org/docs/troubleshooting
- Open Source: https://8thwall.org/docs/open-source
- GitHub: https://github.com/8thwall

---

# 28. Regra final para o agente

**Sempre prefira a documentação oficial atual do 8th Wall à memória do modelo.**

O agente deve tratar como potencialmente obsoleto qualquer código que use:
- APIs antigas da plataforma hospedada;
- fluxos de publicação anteriores a 2026;
- tutoriais que assumem o antigo 8th Wall Cloud;
- versões antigas do Engine;
- nomes de APIs não encontrados na documentação atual.

Para qualquer decisão técnica envolvendo World Tracking, consultar pelo menos:

1. Engine Overview
2. World Effects / World Tracking
3. Engine API correspondente
4. exemplo oficial
5. Release Notes
6. Troubleshooting

Só depois implementar.

---

## Resultado esperado

Ao final da pesquisa e implementação, o agente deverá conseguir explicar claramente:

```text
Como o 8th Wall Engine é carregado
        ↓
Como o SLAM é inicializado
        ↓
Como o World Tracking funciona
        ↓
Como o Three.js recebe a câmera/pose
        ↓
Como posicionar um objeto
        ↓
Como acompanhar o estado do tracking
        ↓
Como recuperar de tracking limitado
        ↓
Como testar no Safari iOS
        ↓
Como fazer build/deploy
```

E deverá manter uma lista de **fontes oficiais consultadas + versão/data**, para que futuras alterações do 8th Wall possam ser incorporadas sem depender de conhecimento desatualizado.
