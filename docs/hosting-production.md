# Hosting de produção, cache e footprint

Data de referência: 13/08/2026.

Fontes consultadas:

- [8th Wall Engine Overview](https://8thwall.org/docs/engine/overview), para distribuição self-hosted do diretório `dist`;
- [8th Wall Open Source — License Compliance](https://8thwall.org/docs/open-source), para preservação do bundle e avisos legais;
- [Vite — Building for Production](https://vite.dev/guide/build), para o artefato estático e assets com hash;
- [Vercel — `vercel.json`](https://vercel.com/docs/project-configuration/vercel-json), para build, diretório de saída e headers;
- [Vercel — Cache-Control](https://vercel.com/docs/caching/cache-control-headers), para as políticas de revalidação e assets imutáveis;
- [Vercel — Compression](https://vercel.com/docs/how-vercel-cdn-works/compression), para negociação automática de Brotli/gzip;
- [MDN — CSP `script-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src), para execução de WebAssembly sob CSP;
- [MDN — Permissions Policy `camera`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/camera), para limitar câmera à própria origem.

O hosting selecionado é a Vercel, no projeto conectado ao repositório remoto e
exposto em <https://webar-app-psi.vercel.app/>. O contrato é versionado no
[`vercel.json`](../vercel.json). Executar `vite preview` não comprova cache,
compressão ou headers do CDN; essas características precisam ser validadas após
o deploy gerado por commit e push.

## Artefato publicável

Execute:

```bash
npm ci
npm run build
```

Publique somente o conteúdo de `dist/`. O `postbuild` preserva e verifica os
avisos legais do Engine e executa `npm run audit:build`.

O Engine fica em um caminho que contém a versão fixada do pacote:

```text
/external/xr/v1.0.0/
```

Essa versão no URL permite cache imutável sem combinar `xr.js`, `xr-slam.js` e
workers de releases diferentes. Atualizar `@8thwall/engine-binary` gera um novo
caminho automaticamente; a regra equivalente do hosting também deve ser
atualizada.

O pacote oficial inteiro é mantido sem poda. Alguns recursos não são usados no
fluxo atual, mas remover arquivos internos sem um manifesto oficial pode quebrar
carregamentos dinâmicos do Engine ou da captura.

## Cache obrigatório

| Caminho | `Cache-Control` |
| --- | --- |
| `/` e `/index.html` | `public, max-age=0, must-revalidate` |
| `/assets/*` | `public, max-age=31536000, immutable` |
| `/external/xr/v1.0.0/*` | `public, max-age=31536000, immutable` |

O HTML precisa revalidar para descobrir novos hashes. Assets Vite e o diretório
versionado do Engine podem ser imutáveis. Não aplique cache imutável a um caminho
do Engine que não contenha a versão.

## Compressão e MIME

A Vercel negocia Brotli automaticamente quando o cliente anuncia `br` e usa gzip
como fallback para MIME types compatíveis. Não são gerados arquivos `.br` no
repositório. O deploy anterior à configuração já confirmou `Content-Encoding:
br` no HTML e em `xr.js`.

MIME types mínimos:

| Extensão | `Content-Type` |
| --- | --- |
| `.html` | `text/html; charset=utf-8` |
| `.js` | `text/javascript; charset=utf-8` |
| `.css` | `text/css; charset=utf-8` |
| `.svg` | `image/svg+xml` |
| `.glb` | `model/gltf-binary` |
| `.tflite` | `application/octet-stream` |

Use `X-Content-Type-Options: nosniff`; por isso, MIME incorreto deve falhar na
homologação em vez de ser tolerado pelo navegador.

## Segurança e permissões

O [`vercel.json`](../vercel.json) mantém câmera, acelerômetro, giroscópio e
magnetômetro na própria origem, bloqueia microfone e geolocalização e permite
workers/arquivos `blob:` usados pela captura. A diretiva `wasm-unsafe-eval` é
necessária para execução de WebAssembly sob CSP em navegadores compatíveis.

A CSP começa como `Content-Security-Policy-Report-Only`: ela informa violações
no console sem bloquear o Engine. Só deve ser promovida para
`Content-Security-Policy` após câmera, SLAM, foto e vídeo passarem no Android e no
iPhone pelo deploy real. `X-Frame-Options: DENY`, Permissions Policy, Referrer
Policy e `nosniff` já são aplicados de forma efetiva.

Não habilite COOP/COEP ou altere CSP diretamente em produção sem repetir câmera,
SLAM, foto, vídeo, compartilhamento e retomada no Android e iPhone.

## Separação de bundles

O build mantém chunks próprios para diagnóstico e captura e separa Three.js em
um chunk com hash. Isso permite que o navegador reutilize Three.js após releases
que alterem apenas a aplicação e elimina o aviso de chunk principal acima de
500 kB. O diagnóstico continua sendo requisitado somente com
`?diagnostics=1`.

O audit do build falha quando:

- um arquivo obrigatório do Engine/captura está ausente;
- o HTML contém paths de desenvolvimento ou placeholder não resolvido;
- diagnóstico passa a ser carregado diretamente pelo HTML;
- source maps públicos aparecem no artefato;
- o entrypoint da aplicação supera 70 KiB em gzip.

## Deploy e homologação na Vercel

O push para o branch de produção do repositório conectado dispara o deploy. A
Vercel executa `npm ci`, `npm run build` e publica `dist/`, conforme o arquivo de
configuração. Depois que o dashboard indicar **Ready**, valide com DevTools ou
execute:

```bash
npm run verify:deployment -- https://webar-app-psi.vercel.app/
```

O comando falha se o deploy ainda estiver antigo ou se cache, compressão, MIME,
paths e headers divergirem do contrato. Em seguida, valide no aparelho:

1. `/` revalida e não usa cache imutável.
2. `/assets/<hash>.js` retorna cache imutável e Brotli/gzip.
3. `/external/xr/v1.0.0/xr.js`, `xr-slam.js` e
   `resources/media-worker.js` retornam `200`, MIME correto, compressão e cache
   imutável.
4. `LICENSE` permanece publicamente acessível no diretório versionado.
5. Uma segunda navegação apresenta transferências por cache, sem misturar
   versões.
6. Câmera, tracking, foto, vídeo e compartilhamento funcionam pela URL HTTPS.

Registre cold/warm start no hosting definitivo. Essa medição substitui os
resultados obtidos com Vite/ngrok para aceite de produção.
