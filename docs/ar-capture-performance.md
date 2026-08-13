# Captura AR e validação de performance

## Objetivo

Validar foto, vídeo de até 10 segundos e compartilhamento sem degradar o startup,
o tracking ou a estabilidade da experiência em um Android intermediário e em um
iPhone. Nenhum relatório é enviado automaticamente.

## Implementação

### Foto

- API: `XR8.CanvasScreenshot`.
- Configuração: `maxDimension: 1280`, `jpgCompression: 75`.
- Saída: JPEG contendo o canvas de câmera e Three.js, sem a interface HTML.
- Fonte oficial, consultada em 11/08/2026:
  <https://8thwall.org/docs/api/engine/canvasscreenshot>.

### Vídeo

- API: `XR8.MediaRecorder`.
- Configuração: `maxDurationMs: 10000`, `maxDimension: 720`, sem end card.
- Microfone: `RequestMicOptions.MANUAL`; a aplicação não solicita áudio.
- Saída final: MP4. No Android, um preview WebM pode aparecer enquanto o Engine
  finaliza o MP4.
- Se o usuário descartar essa prévia, a finalização continua em segundo plano:
  Foto permanece disponível e Vídeo é reabilitado somente após `onVideoReady`.
- O tempo de finalização usa o intervalo entre `onStop` e `onVideoReady`, isolado
  do lifecycle de fotos e prévias abertas enquanto o MP4 é processado.
- Fonte oficial, consultada em 11/08/2026:
  <https://8thwall.org/docs/api/engine/mediarecorder>.

Os módulos são anexados somente após o primeiro placement. Placement e recenter
ficam bloqueados enquanto uma captura está ativa. A prévia mantém o pipeline AR
em execução atrás da interface fullscreen, evitando uma relocalização a cada
uso de **Refazer**. `XR8.pause()` permanece reservado para interrupções reais,
como ocultar a página, bloquear a tela ou girar durante uma gravação.

### Compartilhamento

O arquivo é testado com `navigator.canShare({files})` e compartilhado somente a
partir do botão, preservando a ativação transitória exigida pelo navegador. Se o
recurso não estiver disponível, o download local continua acessível.

Fonte consultada em 11/08/2026:
<https://developer.mozilla.org/docs/Web/API/Navigator/share>.

## Executar o diagnóstico

Abra a aplicação HTTPS com:

```text
?diagnostics=1
```

O relatório inclui:

- disponibilidade do Engine desde a navegação e tempos, a partir do clique, até
  SLAM, câmera, pipeline e `tracking-ready`;
- FPS médio, p95 de frame e frames com 50 ms ou mais;
- perdas espontâneas de tracking, separadas das pausas e retomadas intencionais;
- agregados de todas as fotos e vídeos: latência, duração/FPS, finalização e tamanho;
- memória no início, durante as capturas, após cada descarte e ao exportar;
- pausas, retomadas, compartilhamentos e erros;
- Resource Timing dos arquivos `xr.js` e `xr-slam.js`;
- memória JavaScript quando o navegador expõe `performance.memory`.

Preencha manualmente modelo, iluminação, conexão, aquecimento e estabilidade.
Use **Copiar JSON** ou **Baixar JSON** ao final.

## Android — primeira rodada

Coleta realizada em 12/08/2026 no aparelho informado no formulário como
`Redme Note 13`, Chrome 145, Wi-Fi e boa iluminação.

| Medida | Resultado |
| --- | ---: |
| Mediana da linha de base até `tracking-ready` | 2.734 ms |
| Sessão de captura até `tracking-ready` | 2.661 ms |
| FPS médio da sessão inativa | 21,64 |
| FPS mediano durante os vídeos | 13,95 |
| Latência mediana das fotos | 112,65 ms |
| Finalização mediana dos MP4 | 8.370 ms |

Startup e fotos atenderam aos critérios. O vídeo atingiu 72,8% do FPS da linha
de base, abaixo da meta de 80%. Por decisão de produto, esta iteração mantém
`maxDimension: 720` e mede isoladamente o efeito das correções de lifecycle e
diagnóstico antes de reconsiderar a resolução.

A sessão inativa registrou três perdas espontâneas de tracking e o teste manual
relatou deriva ao circular ao redor do objeto. A primeira implementação também
pausava o Engine em toda prévia, criando quatorze ciclos de relocalização na
sessão de captura.

## Android — segunda rodada

A V2 confirmou que manter o AR ativo resolveu o deslocamento imediato após
**Refazer**: restou deriva gradual ao circular e afastar-se do objeto. A sessão
de captura teve somente três pausas reais e nenhuma perda espontânea reportada.

| Medida | Resultado V2 |
| --- | ---: |
| Mediana da linha de base até `tracking-ready` | 3.138 ms |
| Sessão de captura até `tracking-ready` | 3.399 ms (+8,3%) |
| FPS médio da sessão inativa | 20,87 |
| FPS mediano dos três primeiros vídeos | 15,60 (81% da base) |
| FPS mediano dos ciclos de stress | 10,47 (54,3% da base) |
| Latência mediana das fotos | 122,80 ms |
| Memória inicial/pico/final reportada | 123 MB / 123 MB / 123 MB |

A V2 também reproduziu uma tentativa de nova gravação enquanto o MP4 anterior
ainda era finalizado. O modo Vídeo agora permanece bloqueado nesse intervalo,
com Foto disponível. Para reduzir custo de fill-rate sem alterar
`MediaRecorder.maxDimension: 720`, o drawing buffer da experiência limita o DPR
a 2,0. A próxima coleta Android deverá estabelecer uma nova linha de base para
essa configuração.

## Android — terceira rodada e conclusão disponível

A V3 foi coletada em 12/08/2026 no Redmi Note 13 informado pelo usuário, Chrome
145, Wi-Fi e boa iluminação. Os relatórios ainda usaram o modo `development`;
por isso, a confirmação no artefato de produção foi incorporada à homologação do
hosting no ponto 6.

| Medida | Resultado V3 | Aceite |
| --- | ---: | --- |
| Mediana da linha de base até `tracking-ready` | 3.298 ms | +5,1% sobre V2; aprovado |
| Retenção do FPS de referência | 95,9% | aprovado no limite |
| FPS médio da sessão inativa | 20,84 | estável |
| FPS médio da sessão de stress | 16,55 | 85,9% da base original |
| FPS médio durante vídeo | 12,28 | 63,7% da base; reprovado na meta de 80% |
| Latência mediana das fotos | 121,60 ms | aprovado |
| Vídeos iniciados/parados/prontos | 10 / 10 / 10 | aprovado |
| Finalizações após **Refazer** | 6 | aprovado, sem erro |
| Memória inicial/pico/final | 123 / 157 / 157 MB | novo patamar estável, sem crescimento contínuo |

O limite de DPR em 2,0 não causou perda visual significativa segundo a validação
manual, mas também não elevou o vídeo a 80% do FPS de referência. Por decisão de
produto, o vídeo permanece em 720 px. A sessão inativa ficou razoavelmente
estável até ocorrer um deslocamento significativo após movimento mais rápido,
circulação e afastamento. Esse comportamento permanece registrado como limitação
do World Tracking; nenhuma correção de placement foi incorporada nesta rodada.

Em 13/08/2026, um teste Android direcionado confirmou a correção da métrica de
finalização: um vídeo de 10 segundos foi descartado, uma foto ficou pronta
enquanto o MP4 continuava em segundo plano e `finalizationMs` registrou 10.041,9
ms, sem erro ou perda de tracking.

### Estado do ponto 5

O ponto 5 está encerrado para continuidade do projeto com conclusão técnica no
Android. A matriz equivalente no iPhone não foi executada por indisponibilidade
temporária do aparelho e continua sendo requisito pendente para aceite
multiplataforma. Não interpretar esta conclusão como comprovação de performance
no Safari/iOS.

## Protocolo nos aparelhos

Para cada plataforma, preserve rede e iluminação entre os ciclos:

1. Limpe os dados do site, abra a URL e exporte uma inicialização fria.
2. Recarregue e exporte duas inicializações com cache.
3. Mantenha o AR por cinco minutos sem capturar.
4. Tire três fotos.
5. Grave um vídeo e pare manualmente.
6. Grave um vídeo até a parada automática em 10 segundos.
7. Inicie outro vídeo e minimize ou gire o aparelho.
8. Compartilhe uma foto e um vídeo.
9. Repita cinco ciclos de captura, prévia e Refazer.

Registre no nome ou junto ao JSON: modelo, versão do sistema, navegador e se a
execução representa linha de base ou captura habilitada.

## Critérios

- mediana até `tracking-ready` no máximo 10% pior que a linha de base;
- FPS sem captura pelo menos 95% da linha de base;
- FPS durante vídeo pelo menos 80% da linha de base;
- foto pronta em até 1,5 segundo;
- timer nunca exibe mais de 10 segundos;
- arquivos não podem ficar pretos, corrompidos ou sem o objeto 3D;
- nenhum pedido de microfone ou erro fatal de tracking;
- memória temporária deve voltar a um patamar semelhante após Refazer.

O vídeo permanece em 720 px. A otimização atual limita somente o DPR do canvas
visual a 2,0. Se a foto ultrapassar 1,5 segundo, reduzir para 960. Se a gravação
for inviável em um ambiente suportado, manter Foto e ocultar Vídeo nesse runtime.

## Limitações

- Safari normalmente não expõe memória JavaScript comparável ao Chromium.
- O navegador não fornece temperatura física; aquecimento é observação manual.
- Fechar a aba ou encerrar o navegador pode impedir a finalização do vídeo.
- O modelo exato do iPhone não é inferido; deve ser informado manualmente.
