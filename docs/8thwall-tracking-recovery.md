# Recuperação de tracking e recenter

## Objetivo

Tornar as transições do World Tracking previsíveis sem alterar o algoritmo
SLAM do 8th Wall. Resultados inseguros bloqueiam o placement imediatamente,
enquanto pequenas oscilações são filtradas antes de alterar a UI.

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
- uma exceção síncrona é exibida como `TRACKING_RECENTER_ERROR`.

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
```

## API e fontes

| Item | Versão/data | Uso | Fonte |
| --- | --- | --- | --- |
| 8th Wall Engine Binary | `1.0.0` | World Tracking e recenter | [Engine](https://8thwall.org/docs/engine) |
| `XR8.XrController.recenter()` | Consultado em 10/08/2026 | Reiniciar tracking sem recarregar a página | [recenter](https://8thwall.org/docs/api/engine/xrcontroller/recenter) |
| `trackingStatus` | Consultado em 10/08/2026 | Consumir `NORMAL` e `LIMITED` | [pipelineModule](https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule) |
| Recuperação | Consultado em 10/08/2026 | Orientação e recenter manual | [World Tracking Issues](https://8thwall.org/docs/troubleshooting/world-tracking-issues) |

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
9. Testar retrato, paisagem, recarga, retry e toques repetidos no controle.

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

## Limitações

- recenter não aumenta a precisão interna do SLAM;
- o placement anterior não é preservado;
- pequenos tremores e deriva podem continuar ocorrendo;
- permanece apenas um plano horizontal dinâmico em `Y = 0`;
- não há múltiplos planos, mesa independente ou anchor persistente.
