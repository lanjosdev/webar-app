# Recuperação de tracking e recenter

## Objetivo

Tornar as transições do World Tracking e o lifecycle da sessão previsíveis sem
alterar o algoritmo SLAM do 8th Wall. Resultados inseguros bloqueiam o placement
imediatamente, pequenas oscilações são filtradas antes de alterar a UI e
interrupções do navegador não deixam uma sessão parcialmente ativa.

O recenter é uma ação manual. Ele reinicia o tracking usando a origem e a
direção configuradas por `XR8.XrController.updateCameraProjectionMatrix()`.
Como o referencial espacial é redefinido, o objeto colocado é removido e deve
ser posicionado novamente.

## Comportamento implementado

- `NORMAL` precisa permanecer estável por 500 ms antes de liberar o placement;
- `LIMITED` ou resultado ausente bloqueia o placement e oculta o retículo no
  mesmo frame;
- a UI só entra em `tracking-limited` depois de 750 ms inseguros consecutivos;
- o cubo colocado permanece visível durante uma perda temporária;
- `XR8.XrController.recenter()` é chamado sem recriar câmera, pipeline ou cena;
- o recenter entra em `tracking-recovering`, remove o placement e espera 500 ms
  estáveis em `NORMAL`;
- após 8 segundos sem recuperação, a aplicação volta a
  `tracking-limited` e permite uma nova tentativa;
- `XR8.pause()` bloqueia o placement e preserva o objeto quando a página fica oculta;
- `XR8.resume()` exige novamente 500 ms estáveis em `NORMAL` antes de liberar interação;
- `visibilitychange`, `pagehide` e `pageshow` podem ocorrer repetidamente sem duplicar a ação;
- falhas fatais encerram câmera, módulos e cena, mantendo `error` até um reset explícito;
- exceções de recenter e lifecycle são exibidas como `TRACKING_RECENTER_ERROR`
  e `SESSION_LIFECYCLE_ERROR`.

As janelas de tempo usam o relógio monotônico do navegador e são avaliadas no
loop existente. Não há timers adicionais, alocações Three.js por frame nem
propagação de pose para a UI.

## Fluxo

```text
primeiro NORMAL por 500 ms
    → tracking-ready
    → placement habilitado

LIMITED ou resultado ausente
    → placement bloqueado imediatamente
    → retículo oculto
    → tracking-limited após 750 ms

NORMAL recuperado por 500 ms
    → tracking-ready
    → retículo e placement restaurados

Recentrar
    → confirmar se existir objeto
    → XR8.XrController.recenter()
    → objeto removido e placement resetado
    → tracking-recovering
    → novo placement após NORMAL estável

Página oculta
    → paused
    → XR8.pause()
    → objeto preservado e placement bloqueado

Página visível novamente
    → XR8.resume()
    → tracking-recovering
    → placement restaurado após NORMAL estável

Erro fatal
    → error terminal
    → XR8.stop() e módulos removidos
    → retry cria uma sessão nova
```

## API e fontes

| Item | Versão/data | Uso | Fonte |
| --- | --- | --- | --- |
| 8th Wall Engine Binary | `1.0.0` | World Tracking e recenter | [Engine](https://8thwall.org/docs/engine) |
| `XR8.XrController.recenter()` | Consultado em 10/08/2026 | Reiniciar tracking sem recarregar a página | [recenter](https://8thwall.org/docs/api/engine/xrcontroller/recenter) |
| `trackingStatus` | Consultado em 10/08/2026 | Consumir `NORMAL` e `LIMITED` | [pipelineModule](https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule) |
| Recuperação | Consultado em 10/08/2026 | Orientação e recenter manual | [World Tracking Issues](https://8thwall.org/docs/troubleshooting/world-tracking-issues) |
| `XR8.isPaused()` | Consultado em 11/08/2026 | Tornar pause/resume idempotentes | [isPaused](https://8thwall.org/docs/api/engine/xr8/ispaused) |
| `XR8.pause()` | Consultado em 11/08/2026 | Suspender a sessão quando a página fica oculta | [pause](https://8thwall.org/docs/api/engine/xr8/pause) |
| `XR8.resume()` | Consultado em 11/08/2026 | Retomar a sessão pausada | [resume](https://8thwall.org/docs/api/engine/xr8/resume) |
| `XR8.stop()` | Consultado em 11/08/2026 | Encerrar a câmera após erro fatal | [stop](https://8thwall.org/docs/api/engine/xr8/stop) |

## Roteiro de validação móvel

Executar três ciclos completos em Android/Chrome e iPhone/Safari:

1. Iniciar e aguardar o retículo aparecer somente após tracking estável.
2. Posicionar o cubo e provocar uma perda breve; confirmar que o painel não
   expande, mas o retículo desaparece e o toque não move o cubo.
3. Manter uma condição ruim por mais de 750 ms; confirmar mensagem expandida,
   cubo visível e placement bloqueado.
4. Retornar a um piso texturizado e confirmar recuperação automática.
5. Abrir a confirmação de recenter e cancelar; o cubo deve permanecer.
6. Confirmar o recenter; o cubo deve sumir e o estado deve indicar recuperação.
7. Após `NORMAL`, realizar um novo placement.
8. Repetir com deriva aparente enquanto o estado ainda estiver `NORMAL`.
9. Minimizar por 5 e 30 segundos, retornar e confirmar objeto preservado,
   estado de recuperação e placement bloqueado até `NORMAL` estável.
10. Bloquear/desbloquear a tela e repetir a validação de retomada.
11. Testar retrato, paisagem, recarga, retry e toques repetidos no controle.

| Plataforma | Ciclo 1 | Ciclo 2 | Ciclo 3 | Timeout/novo recenter | Resultado |
| --- | --- | --- | --- | --- | --- |
| Android/Chrome | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado |
| iPhone/Safari | Aprovado | Aprovado | Aprovado | Aprovado | Aprovado |

## Resultado registrado

Em 10/08/2026, o fluxo de recuperação, cancelamento e confirmação do
recenter foi confirmado em Android/Chrome e iPhone/Safari. O recenter removeu o
objeto anterior, reiniciou o tracking e permitiu um novo placement após a
recuperação. Os botões da confirmação responderam corretamente nas duas
plataformas após a correção de eventos do painel.

Modelos dos aparelhos, versões dos sistemas/navegadores e tempos medidos não
foram informados e permanecem sem registro; nenhum valor foi presumido.

O lifecycle de pausa/retomada e o encerramento terminal foram implementados em
11/08/2026. Na mesma data, a validação manual foi informada como aprovada em
Android e iPhone reais. Modelos, versões e quantidade de ciclos não foram
informados e, por isso, nenhum desses dados foi presumido.

## Limitações

- recenter não aumenta a precisão interna do SLAM;
- o placement anterior não é preservado;
- pequenos tremores e deriva podem continuar ocorrendo;
- modelos, versões e quantidade de ciclos da validação de pausa/retomada ainda precisam ser registrados;
- permanece apenas um plano horizontal dinâmico em `Y = 0`;
- não há múltiplos planos, mesa independente ou anchor persistente.
