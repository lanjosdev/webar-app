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
- Fonte oficial, consultada em 11/08/2026:
  <https://8thwall.org/docs/api/engine/mediarecorder>.

Os módulos são anexados somente após o primeiro placement. Placement e recenter
ficam bloqueados enquanto uma captura está ativa. Ao abrir a prévia, `XR8.pause()`
é usado; Refazer retoma a sessão e aguarda o tracking voltar a `NORMAL` estável.

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

- tempos até Engine, SLAM, câmera, pipeline e `tracking-ready`;
- FPS médio, p95 de frame e frames com 50 ms ou mais;
- perdas e recuperações de tracking;
- latência da foto, duração/FPS do vídeo, finalização e tamanho dos arquivos;
- pausas, retomadas, compartilhamentos e erros;
- Resource Timing dos arquivos `xr.js` e `xr-slam.js`;
- memória JavaScript quando o navegador expõe `performance.memory`.

Preencha manualmente modelo, iluminação, conexão, aquecimento e estabilidade.
Use **Copiar JSON** ou **Baixar JSON** ao final.

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

Se o vídeo não atingir o limite relativo, alterar a dimensão máxima para 540 e
repetir. Se a foto ultrapassar 1,5 segundo, reduzir para 960. Se a gravação ainda
for inviável em um ambiente suportado, manter Foto e ocultar Vídeo nesse runtime.

## Limitações

- Safari normalmente não expõe memória JavaScript comparável ao Chromium.
- O navegador não fornece temperatura física; aquecimento é observação manual.
- Fechar a aba ou encerrar o navegador pode impedir a finalização do vídeo.
- O modelo exato do iPhone não é inferido; deve ser informado manualmente.
