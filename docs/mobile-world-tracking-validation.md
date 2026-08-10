# Validação móvel do World Tracking

## Objetivo

Validar o POC em Android/Chrome e iPhone/Safari reais, usando câmera traseira e
HTTPS. O cubo é uma referência fixa com a base em `Y = 0`; ele não representa
placement, hit test ou detecção de múltiplos planos.

## Registro preliminar

Antes do aterramento do cubo, um smoke test em Android confirmou:

- carregamento da aplicação por ngrok/HTTPS;
- câmera traseira e canvas fullscreen;
- estado `tracking-ready`;
- renderização do cubo.

Esse registro não substitui a matriz abaixo, pois o aparelho, as versões e o
comportamento do cubo após a alteração ainda precisam ser documentados.

## Dispositivos

Preencha antes dos testes:

| Plataforma | Modelo | Sistema | Navegador e versão | Data |
| --- | --- | --- | --- | --- |
| Android | Pendente | Pendente | Chrome — pendente | Pendente |
| iPhone | Pendente | Pendente | Safari — pendente | Pendente |

## Procedimento base

1. Inicie o Vite e o ngrok conforme o README.
2. Feche abas antigas e abra uma nova aba pela URL HTTPS.
3. Toque em **Iniciar AR** e meça o tempo até a mensagem `Tracking ativo`.
4. Confirme câmera traseira, canvas preenchendo a viewport e cubo visível.
5. Aponte para um piso iluminado, texturizado e com contraste; mova lentamente
   até o tracking estabilizar.
6. Escolha uma marca física próxima à base do cubo e faça um arco lateral lento
   durante 30 segundos.
7. Considere aprovado quando o cubo não acompanhar a câmera e não apresentar
   saltos recorrentes maiores que aproximadamente sua própria largura. Pequeno
   tremor visual é aceitável.
8. Gire para paisagem e retorne a retrato; confirme canvas e alinhamento.
9. Recarregue a página e confirme que a câmera pode ser aberta novamente.
10. Repita três inicializações completas em cada plataforma.

## Matriz de inicialização

Registre o tempo do toque em **Iniciar AR** até `tracking-ready`.

| Plataforma | Execução 1 | Execução 2 | Execução 3 | Câmera traseira | Canvas fullscreen | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| Android/Chrome | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente |
| iPhone/Safari | Pendente | Pendente | Pendente | Pendente | Pendente | Pendente |

## Matriz ambiental e de recuperação

Após cada condição adversa, retorne ao piso iluminado e texturizado e registre
se o tracking se recupera sem recarregar a página.

| Cenário | Android/Chrome | iPhone/Safari | Observações |
| --- | --- | --- | --- |
| Piso iluminado e texturizado, movimento lento por 30 s | Pendente | Pendente | |
| Piso liso ou com pouco contraste | Pendente | Pendente | |
| Pouca iluminação | Pendente | Pendente | |
| Superfície reflexiva | Pendente | Pendente | |
| Movimento rápido seguido de movimento lento | Pendente | Pendente | |
| Rotação retrato → paisagem → retrato | Pendente | Pendente | |
| Recarga e reabertura da câmera | Pendente | Pendente | |
| Permissão negada e nova tentativa após liberar | Pendente | Pendente | |

Use `Aprovado`, `Degradado com recuperação` ou `Falhou` em cada célula e registre
saltos, drift, aquecimento, falhas de câmera/GPU e tempo de recuperação.

## Comportamentos esperados

- O preenchimento fullscreen recorta as laterais do vídeo em telas verticais e
  pode parecer um leve zoom.
- `scale: 'responsive'` não garante que unidades da cena correspondam a metros.
- As barras do navegador e do sistema operacional permanecem visíveis.
- O cubo é fixo no mundo e apoiado no plano horizontal estimado, mas o usuário
  ainda não pode reposicioná-lo.
- Pequeno tremor é aceitável; saltos recorrentes, cubo seguindo a câmera ou
  ausência de recuperação não são.

## Critério de conclusão

A fase termina somente quando as duas linhas da matriz de inicialização forem
aprovadas, o cenário base de 30 segundos for aprovado em ambos os aparelhos, os
cenários adversos não causarem travamento e `npm run typecheck` e
`npm run build` passarem.
